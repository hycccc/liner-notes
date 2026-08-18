#!/usr/bin/env node
/**
 * 每日同步网易云"我喜欢的音乐"前10首到网站
 * - 滚动窗口模式：始终保持最近添加的10首歌
 * - 高效增量：文件名基于ID，顺序变化无需重新下载
 * - 自动清理：删除超出范围的旧歌曲文件
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Point at your self-hosted NeteaseCloudMusicApi checkout (or any API with the same surface)
const API_BASE = process.env.MUSIC_API_DIR || './NeteaseCloudMusicApi';
const api = require(path.join(API_BASE, 'node_modules', 'NeteaseCloudMusicApi'));
const cookie = fs.readFileSync(path.join(API_BASE, 'cookie.txt'), 'utf8').trim();

const WEBSITE_ROOT = path.resolve(__dirname, '..');
const MUSIC_DIR = path.join(WEBSITE_ROOT, 'public', 'music');
const DATA_FILE = path.join(WEBSITE_ROOT, 'data', 'index.tsx');

const UID = 272523181;
const LIMIT = 10;

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
  });
}

async function getLatest10() {
  const playlists = await api.user_playlist({ uid: UID, cookie });
  const likedPlaylist = playlists.body.playlist.find(p => p.name.includes('喜欢'));
  if (!likedPlaylist) throw new Error('找不到"我喜欢的音乐"歌单');

  const detail = await api.playlist_detail({ id: likedPlaylist.id, cookie });
  const trackIds = detail.body.playlist.trackIds;

  trackIds.sort((a, b) => b.at - a.at);
  const top10Ids = trackIds.slice(0, LIMIT).map(t => t.id);

  const songDetail = await api.song_detail({ ids: top10Ids.join(','), cookie });
  const songs = songDetail.body.songs;

  const ordered = top10Ids.map(id => songs.find(s => s.id === id)).filter(Boolean);
  
  const songsWithMeta = [];
  for (const song of ordered) {
    let tags = [];
    try {
      const wiki = await api.song_wiki_summary({ id: song.id, cookie });
      if (wiki.body?.data?.blocks) {
        const basicBlock = wiki.body.data.blocks.find(b => b.code === 'SONG_PLAY_ABOUT_SONG_BASIC');
        if (basicBlock?.creatives) {
          for (const c of basicBlock.creatives) {
            if ((c.creativeType === 'songTag' || c.creativeType === 'songBizTag') && c.resources) {
              for (const r of c.resources) {
                const title = r.uiElement?.mainTitle?.title;
                if (title) tags.push(title);
              }
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
    
    if (tags.length === 0) {
      const artist = song.ar.map(a => a.name).join(', ');
      const isJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(artist);
      const isEnglish = /^[a-zA-Z\s\d\$\.,'\-!?]+$/.test(song.name);
      
      if (isJapanese) tags = ['日语', 'J-Pop'];
      else if (isEnglish) tags = ['英文', '流行'];
      else tags = ['华语', '流行'];
    }
    
    tags = tags.slice(0, 3);

    songsWithMeta.push({
      id: song.id,
      title: song.name,
      artist: song.ar.map(a => a.name).join(', '),
      album: song.al.name,
      coverUrl: song.al.picUrl,
      duration: song.dt,
      tags,
    });
  }

  return songsWithMeta;
}

async function syncSong(song, index) {
  // 文件名使用 ID，确保排序变化时无需重下载
  const mp3File = `${song.id}.mp3`;
  const coverFile = `${song.id}.jpg`;
  const mp3Path = path.join(MUSIC_DIR, mp3File);
  const coverPath = path.join(MUSIC_DIR, coverFile);

  if (fs.existsSync(mp3Path) && fs.existsSync(coverPath)) {
    console.log(`  ✅ #${index + 1} ${song.title} - 缓存命中`);
    return { ...song, file: mp3File, cover: coverFile };
  }

  console.log(`  ⬇️  #${index + 1} ${song.title} - ${song.artist}`);

  try {
    await download(song.coverUrl + '?param=300y300', coverPath);
    console.log(`     📀 封面下载成功`);
  } catch (e) {
    console.error(`     ❌ 封面失败: ${e.message}`);
  }

  try {
    const urlRes = await api.song_url_v1({ id: song.id, level: 'standard', cookie });
    const audioUrl = urlRes.body.data[0]?.url;
    if (!audioUrl) {
      console.error(`     ❌ 无法获取音频URL`);
      return null;
    }
    await download(audioUrl, mp3Path);
    console.log(`     🎵 音频下载成功`);
  } catch (e) {
    console.error(`     ❌ 音频失败: ${e.message}`);
    return null;
  }

  return { ...song, file: mp3File, cover: coverFile };
}

function generatePlaylistCode(songs) {
  const entries = songs.map((s, i) => {
    const tagsStr = s.tags.map(t => `"${t}"`).join(', ');
    return `  { id: ${s.id}, title: "${s.title.replace(/"/g, '\\"')}", artist: "${s.artist.replace(/"/g, '\\"')}", file: "${s.file}", cover: "/music/${s.cover}", tags: [${tagsStr}] }`;
  });
  return entries.join(',\n');
}

function cleanupOldFiles(validFiles) {
  if (!fs.existsSync(MUSIC_DIR)) return;
  const allFiles = fs.readdirSync(MUSIC_DIR);
  let count = 0;
  for (const f of allFiles) {
    // 只清理 mp3 和 jpg，避免误删 .gitkeep 等
    if ((f.endsWith('.mp3') || f.endsWith('.jpg')) && !validFiles.includes(f)) {
      fs.unlinkSync(path.join(MUSIC_DIR, f));
      console.log(`  🗑️  已删除旧文件: ${f}`);
      count++;
    }
  }
  if (count === 0) console.log('  ✨ 没有需要清理的旧文件');
}

// ─── Deploy hook ────────────────────────────────────────────────────────────
// After a sync, deploy however you normally deploy (see scripts/deploy.sh).
// This template intentionally ships no remote-server credentials or hosts.
async function syncToVPS() {
  console.log('\nℹ️  sync complete — run scripts/deploy.sh to publish (DEPLOY_HOST/DEPLOY_PATH env).');
}


async function main() {
  console.log('🎵 开始同步网易云"我喜欢的音乐"...\n');

  console.log('📋 获取歌单...');
  const songs = await getLatest10();
  console.log(`   找到 ${songs.length} 首歌\n`);

  console.log('📥 增量下载...');
  const finalSongs = [];
  const keepFiles = [];

  for (let i = 0; i < songs.length; i++) {
    const result = await syncSong(songs[i], i);
    if (result) {
      finalSongs.push(result);
      keepFiles.push(result.file);
      keepFiles.push(result.cover);
    }
  }

  console.log('\n🧹 清理旧文件...');
  cleanupOldFiles(keepFiles);

  console.log('\n📝 更新 playlist 数据...');
  const dataContent = fs.readFileSync(DATA_FILE, 'utf8');
  const playlistCode = generatePlaylistCode(finalSongs);

  const playlistRegex = /(export const playlist:\s*Song\[\]\s*=\s*\[)\n[\s\S]*?(\];)/;
  let dataChanged = false;
  if (playlistRegex.test(dataContent)) {
    const newData = dataContent.replace(playlistRegex, `$1\n${playlistCode}\n$2`);
    fs.writeFileSync(DATA_FILE, newData);
    dataChanged = newData !== dataContent;
    console.log('   ✅ data/index.tsx 已更新');
  } else {
    console.error('   ❌ 无法找到 playlist 数组');
  }

  // VPS 同步（每次都执行，确保音乐文件和数据一致）
  try {
    await syncToVPS();
  } catch (e) {
    console.error(`\n⚠️  VPS 同步失败（本地同步已完成）: ${e.message}`);
  }

  console.log('\n🎉 全部完成！');
}

main().catch(e => {
  console.error('❌ 同步失败:', e.message);
  process.exit(1);
});
