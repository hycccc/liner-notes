#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const WEBSITE_ROOT = path.resolve(__dirname, '..');
const TMP_DIR = path.join(WEBSITE_ROOT, 'tmp');
const TOPICS_PATH = path.join(TMP_DIR, 'topics.json');
const TOPIC_COUNT_PER_CATEGORY = 3;
const SUMMARY_LIMIT = 2000;

const SOURCES = {
  techApi: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30',
  techRss: 'https://hnrss.org/frontpage?count=30',
  musicRssPrimary: 'https://pitchfork.com/rss/news/feed.xml',
  musicRssFallback: 'https://pitchfork.com/feed/rss/news/',
  socialWorldRss: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  socialTopRss: 'https://feeds.bbci.co.uk/news/rss.xml',
  midifanNewsRss: 'https://www.midifan.com/rss-news.htm',
  midifanHardwareRss: 'https://www.midifan.com/rss-hardware.htm',
  midifanSoftwareRss: 'https://www.midifan.com/rss-software.htm',
};

const CATEGORY_BACKUP_TOPICS = {
  tech: [
    {
      title: 'Open-source LLM 工程化实践持续升温',
      url: 'https://huggingface.co/blog',
      summary: '社区围绕模型压缩、部署与评测工具持续演进，工程效率与可维护性成为新焦点。',
    },
    {
      title: '浏览器与 AI 助手的集成场景继续扩展',
      url: 'https://developer.chrome.com/blog/',
      summary: '围绕自动化、无障碍与内容理解的能力被逐步产品化，前端工作流受到直接影响。',
    },
    {
      title: '开发者对可观测性与成本优化关注上升',
      url: 'https://www.cncf.io/blog/',
      summary: '在推理成本与服务稳定性压力下，监控、缓存与弹性架构实践持续成为热门话题。',
    },
  ],
  music: [
    {
      title: '流媒体平台继续影响新歌发行节奏',
      url: 'https://pitchfork.com/news/',
      summary: '从单曲预热到专辑投放，艺人与厂牌在平台算法环境中不断调整发行策略。',
    },
    {
      title: '现场演出市场热度回升，票务策略再调整',
      url: 'https://www.billboard.com/music/',
      summary: '音乐节与巡演在不同地区呈现结构性分化，定价与分发渠道成为行业讨论重点。',
    },
    {
      title: '独立音乐人通过短视频渠道获得新增量',
      url: 'https://www.rollingstone.com/music/music-news/',
      summary: '内容切片与社区运营强化了独立发行能力，也提升了艺人对自有品牌的掌控度。',
    },
  ],
  social: [
    {
      title: '全球地缘议题持续影响公共讨论',
      url: 'https://www.bbc.com/news/world',
      summary: '多个地区议题交织，政策走向与国际协作成为社会新闻关注重点。',
    },
    {
      title: '城市治理与民生政策成为舆论核心',
      url: 'https://www.reuters.com/world/',
      summary: '住房、就业与公共服务供给在不同国家呈现差异化挑战，相关政策持续调整。',
    },
    {
      title: '科技平台治理与信息可信度再受关注',
      url: 'https://www.theguardian.com/world',
      summary: '平台规则、内容传播机制及媒体责任在国际范围内不断引发新一轮讨论。',
    },
  ],
  midifan: [
    {
      title: '软硬件工作流一体化仍是制作趋势',
      url: 'https://www.midifan.com/',
      summary: '从编曲到混音，MIDI 控制、插件协同和硬件互联的效率优化持续受到关注。',
    },
    {
      title: '便携式音乐设备与桌面系统协作增强',
      url: 'https://www.midifan.com/modulearticle-index.htm',
      summary: '制作人愈发重视移动创作与录音棚回传的兼容性，驱动与协议稳定性成为关键。',
    },
    {
      title: '新一代音频插件强调实时性能与可视化',
      url: 'https://www.midifan.com/modulearticle-cat-8.htm',
      summary: '在低延迟和直观反馈需求驱动下，插件厂商持续优化算法效率和交互界面。',
    },
  ],
};

function decodeEntities(input) {
  if (!input) return '';
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(input) {
  if (!input) return '';
  return input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function cleanupText(input) {
  return decodeEntities(stripHtml(String(input || '')))
    .replace(/\s+/g, ' ')
    .trim();
}

function clipText(input, maxLength = SUMMARY_LIMIT) {
  const normalized = cleanupText(input);
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength);
}

function extractXmlTag(block, tagName) {
  const safe = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<${safe}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${safe}>`, 'i');
  const match = block.match(pattern);
  return match ? match[1] : '';
}

function extractXmlAttribute(block, tagName, attributeName) {
  const safeTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const safeAttr = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<${safeTag}\\b[^>]*\\b${safeAttr}\\s*=\\s*(['"])([\\s\\S]*?)\\1[^>]*\\/?>`,
    'i'
  );
  const match = block.match(pattern);
  return match ? match[2] : '';
}

function parseTimestamp(input) {
  const ms = Date.parse(input || '');
  return Number.isNaN(ms) ? 0 : ms;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'liner-notes-auto-blog/1.0',
        Accept: 'application/json, application/rss+xml, text/xml, text/html, text/plain;q=0.9, */*;q=0.8',
      },
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} (${url})`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const responseText = await fetchText(url);
  return JSON.parse(responseText);
}

function parseRssItems(xmlText) {
  const itemMatches = xmlText.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const entryMatches = xmlText.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const blocks = [...itemMatches, ...entryMatches];

  return blocks.map((itemBlock) => {
    const title = cleanupText(extractXmlTag(itemBlock, 'title'));
    const url = cleanupText(
      extractXmlTag(itemBlock, 'link') ||
        extractXmlAttribute(itemBlock, 'link', 'href') ||
        extractXmlTag(itemBlock, 'guid') ||
        extractXmlTag(itemBlock, 'id')
    );
    const description =
      extractXmlTag(itemBlock, 'description') ||
      extractXmlTag(itemBlock, 'summary') ||
      extractXmlTag(itemBlock, 'content:encoded') ||
      extractXmlTag(itemBlock, 'content');
    const summary = cleanupText(description);
    const pubDate = cleanupText(
      extractXmlTag(itemBlock, 'pubDate') ||
        extractXmlTag(itemBlock, 'updated') ||
        extractXmlTag(itemBlock, 'published') ||
        extractXmlTag(itemBlock, 'dc:date')
    );
    const comments = Number(
      cleanupText(extractXmlTag(itemBlock, 'slash:comments') || extractXmlTag(itemBlock, 'comments')) || 0
    );

    return {
      title,
      url,
      summary,
      publishedAt: parseTimestamp(pubDate),
      comments: Number.isFinite(comments) ? comments : 0,
    };
  });
}

function dedupeTopics(topics) {
  const seen = new Set();
  const output = [];

  for (const topic of topics) {
    const key = `${topic.title.toLowerCase()}::${topic.url.toLowerCase()}`;
    if (!topic.title || !topic.url) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(topic);
  }

  return output;
}

function scoreByRecency(timestamp) {
  if (!timestamp) return 0;
  const ageHours = (Date.now() - timestamp) / 3600000;
  if (ageHours < 0) return 40;
  if (ageHours <= 24) return 35;
  if (ageHours <= 72) return 25;
  if (ageHours <= 7 * 24) return 10;
  return 0;
}

function pickTopTopics(topics, count) {
  return topics
    .slice()
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return (b.publishedAt || 0) - (a.publishedAt || 0);
    })
    .slice(0, count);
}

function normalizeHnHit(hit) {
  const title = cleanupText(hit.title || hit.story_title);
  const url = cleanupText(hit.url || hit.story_url);
  const points = Number(hit.points || 0);
  const comments = Number(hit.num_comments || 0);
  const publishedAt = Number(hit.created_at_i || 0) * 1000;
  const summary = cleanupText(hit.story_text || hit.comment_text || '');

  return {
    title,
    url,
    summary,
    publishedAt,
    points: points * 2 + comments,
  };
}

async function fetchTechTopicsFromApi() {
  const data = await fetchJson(SOURCES.techApi);
  const hits = Array.isArray(data.hits) ? data.hits : [];
  const topics = dedupeTopics(hits.map(normalizeHnHit));
  return topics.filter((topic) => topic.title && topic.url && topic.points > 0);
}

async function fetchRssTopics(url) {
  const rssText = await fetchText(url);
  return dedupeTopics(
    parseRssItems(rssText).map((item) => ({
      ...item,
      points: (item.comments || 0) + scoreByRecency(item.publishedAt),
    }))
  );
}

async function collectFromSources(category, sourceLoaders) {
  let combined = [];

  for (const source of sourceLoaders) {
    try {
      const topics = await source.loader();
      const validTopics = dedupeTopics(
        (Array.isArray(topics) ? topics : []).filter((topic) => topic.title && topic.url)
      );

      if (!validTopics.length) {
        console.warn(`⚠️ ${category}/${source.name} 抓取到 0 条，跳过。`);
        continue;
      }

      combined = dedupeTopics([...combined, ...validTopics]);
      console.log(`ℹ️ ${category}/${source.name} 抓到 ${validTopics.length} 条。`);

      if (combined.length >= TOPIC_COUNT_PER_CATEGORY) {
        break;
      }
    } catch (error) {
      console.warn(`⚠️ ${category}/${source.name} 抓取失败，跳过：${error.message}`);
    }
  }

  return combined;
}

function getBackupTopics(category) {
  const now = Date.now();
  const fallback = CATEGORY_BACKUP_TOPICS[category] || [];
  return fallback.map((item, index) => ({
    title: cleanupText(item.title),
    url: cleanupText(item.url),
    summary: cleanupText(item.summary),
    publishedAt: now - index * 3600000,
    points: 5 - index,
  }));
}

async function fetchTechTopicsFromRss() {
  return fetchRssTopics(SOURCES.techRss);
}

async function fetchTechTopics() {
  return collectFromSources('tech', [
    { name: 'HackerNews API', loader: fetchTechTopicsFromApi },
    { name: 'HackerNews RSS', loader: fetchTechTopicsFromRss },
  ]);
}

async function fetchMusicTopics() {
  return collectFromSources('music', [
    { name: 'Pitchfork RSS XML', loader: async () => fetchRssTopics(SOURCES.musicRssPrimary) },
    { name: 'Pitchfork RSS Fallback', loader: async () => fetchRssTopics(SOURCES.musicRssFallback) },
  ]);
}

async function fetchSocialTopics() {
  return collectFromSources('social', [
    { name: 'BBC World RSS', loader: async () => fetchRssTopics(SOURCES.socialWorldRss) },
    { name: 'BBC Top RSS', loader: async () => fetchRssTopics(SOURCES.socialTopRss) },
  ]);
}

async function fetchMidifanTopics() {
  const sourceLoaders = [
    { name: 'Midifan News RSS', url: SOURCES.midifanNewsRss },
    { name: 'Midifan Hardware RSS', url: SOURCES.midifanHardwareRss },
    { name: 'Midifan Software RSS', url: SOURCES.midifanSoftwareRss },
  ];

  let combined = [];

  for (const source of sourceLoaders) {
    try {
      const topics = await fetchRssTopics(source.url);
      const validTopics = dedupeTopics(
        (Array.isArray(topics) ? topics : []).filter((topic) => topic.title && topic.url)
      );

      if (!validTopics.length) {
        console.warn(`⚠️ midifan/${source.name} 抓取到 0 条，跳过。`);
        continue;
      }

      combined = dedupeTopics([...combined, ...validTopics]);
      console.log(`ℹ️ midifan/${source.name} 抓到 ${validTopics.length} 条。`);
    } catch (error) {
      console.warn(`⚠️ midifan/${source.name} 抓取失败，跳过：${error.message}`);
    }
  }

  return combined;
}

async function fetchArticleSummary(url, fallback = '') {
  try {
    const raw = await fetchText(url);
    const summary = clipText(raw, SUMMARY_LIMIT);
    if (summary) return summary;
  } catch (error) {
    console.warn(`⚠️ 抓正文失败: ${url} (${error.message})`);
  }

  const fromFallback = clipText(fallback, SUMMARY_LIMIT);
  return fromFallback || '未能抓到正文摘要。';
}

async function buildCategoryTopics(category, loader) {
  let rawTopics = [];
  try {
    rawTopics = await loader();
  } catch (error) {
    console.warn(`⚠️ 分类 ${category} 主抓取流程失败：${error.message}`);
  }

  let candidates = dedupeTopics(Array.isArray(rawTopics) ? rawTopics : []);
  if (candidates.length < TOPIC_COUNT_PER_CATEGORY) {
    const missingCount = TOPIC_COUNT_PER_CATEGORY - candidates.length;
    const backupTopics = getBackupTopics(category);
    candidates = dedupeTopics([...candidates, ...backupTopics]);
    console.warn(`⚠️ 分类 ${category} 使用 ${Math.min(missingCount, backupTopics.length)} 条备用话题补齐。`);
  }

  const picked = pickTopTopics(candidates, TOPIC_COUNT_PER_CATEGORY);
  const completed = [];
  for (const topic of picked) {
    const summary = await fetchArticleSummary(topic.url, topic.summary);
    completed.push({
      category,
      title: topic.title,
      url: topic.url,
      summary,
      points: Math.max(0, Math.round(topic.points || 0)),
    });
  }

  return completed;
}

async function main() {
  await fs.mkdir(TMP_DIR, { recursive: true });

  const [tech, music, social, midifan] = await Promise.all([
    buildCategoryTopics('tech', fetchTechTopics),
    buildCategoryTopics('music', fetchMusicTopics),
    buildCategoryTopics('social', fetchSocialTopics),
    buildCategoryTopics('midifan', fetchMidifanTopics),
  ]);

  const allTopics = [...tech, ...music, ...social, ...midifan];
  await fs.writeFile(TOPICS_PATH, `${JSON.stringify(allTopics, null, 2)}\n`, 'utf8');

  console.log(`✅ 已生成 ${allTopics.length} 个话题: ${path.relative(WEBSITE_ROOT, TOPICS_PATH)}`);
}

main().catch((error) => {
  console.error(`❌ fetch-news 失败: ${error.message}`);
  process.exitCode = 1;
});
