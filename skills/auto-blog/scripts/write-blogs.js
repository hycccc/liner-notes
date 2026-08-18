#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const WEBSITE_ROOT = path.resolve(__dirname, '..');
const TOPICS_PATH = path.join(WEBSITE_ROOT, 'tmp', 'topics.json');
const POSTS_DIR = path.join(WEBSITE_ROOT, 'posts');
const EXPECTED_TOPICS = 12;
const BATCH_SIZE = 4;

function getDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cleanText(input) {
  return String(input || '').replace(/\s+/g, ' ').trim();
}

function normalizeCategory(rawCategory) {
  const category = cleanText(rawCategory).toLowerCase();
  if (category === 'tech' || category === 'music' || category === 'social' || category === 'midifan') return category;
  return 'social';
}

function categoryTags(category) {
  if (category === 'tech') return ['AI', '技术'];
  if (category === 'music') return ['音乐', '观察'];
  if (category === 'midifan') return ['音乐制作', 'MIDI'];
  return ['社会', '评论'];
}

function buildPrompt(topic, outputPath, dateString) {
  const title = cleanText(topic.title);
  const url = cleanText(topic.url);
  const summary = cleanText(topic.summary);
  const tags = categoryTags(topic.category);

  return [
    `请基于以下素材写一篇中文博文，并直接保存到 ${outputPath}。`,
    '',
    '【素材】',
    `- 话题标题：${title}`,
    `- 来源 URL：${url}`,
    `- 正文摘要：${summary}`,
    '',
    '【硬性要求】',
    '- 文章长度 800-1200 字。',
    '- 必须是中文。',
    '- 使用第一人称写作，有明确观点和判断。',
    '- 不要写成新闻稿，不要罗列快讯口吻。',
    '- 内容可引用素材，但不要虚构来源中没有的事实。',
    '',
    '【Frontmatter 格式（必须与现有 posts 一致）】',
    '```md',
    '---',
    'title: "自拟一个自然、有个人风格的标题"',
    `date: "${dateString}"`,
    'excerpt: "一句话摘要，20-50字"',
    `tags: ["${tags[0]}", "${tags[1]}"]`,
    'readTime: "5 min"',
    '---',
    '```',
    '',
    '请输出为可直接发布的 Markdown 文件内容，并写入指定路径。',
  ].join('\n');
}

function runCodexExec(prompt, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('codex', ['exec', '--full-auto', prompt], {
      cwd: WEBSITE_ROOT,
      stdio: 'inherit',
    });

    child.on('error', (error) => {
      reject(new Error(`调用 codex 命令失败: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`codex exec 失败（exit=${code}）: ${outputPath}`));
        return;
      }
      resolve();
    });
  });
}

async function main() {
  const dateString = getDateString();
  await fs.mkdir(POSTS_DIR, { recursive: true });

  const raw = await fs.readFile(TOPICS_PATH, 'utf8');
  const topics = JSON.parse(raw);

  if (!Array.isArray(topics)) {
    throw new Error('tmp/topics.json 不是数组格式。');
  }
  if (topics.length !== EXPECTED_TOPICS) {
    throw new Error(`tmp/topics.json 期望 ${EXPECTED_TOPICS} 条，实际 ${topics.length} 条。`);
  }

  const categoryIndexMap = new Map();
  const jobs = [];

  for (let i = 0; i < topics.length; i += 1) {
    const topic = topics[i];
    const category = normalizeCategory(topic.category);
    const currentIndex = (categoryIndexMap.get(category) || 0) + 1;
    categoryIndexMap.set(category, currentIndex);

    const filename = `${dateString}-${category}-${currentIndex}.md`;
    const outputPath = path.join('posts', filename);
    const prompt = buildPrompt(topic, outputPath, dateString);
    jobs.push({ index: i, outputPath, prompt });
  }

  for (let start = 0; start < jobs.length; start += BATCH_SIZE) {
    const batch = jobs.slice(start, start + BATCH_SIZE);
    await Promise.all(
      batch.map(async (job) => {
        console.log(`📝 [${job.index + 1}/${topics.length}] 开始写作: ${job.outputPath}`);
        await runCodexExec(job.prompt, job.outputPath);
        console.log(`✅ [${job.index + 1}/${topics.length}] 完成: ${job.outputPath}`);
      }),
    );
  }

  const generatedFiles = jobs.map((job) => job.outputPath);
  console.log('\n🎉 全部博文生成完成，文件如下：');
  for (const file of generatedFiles) {
    console.log(`- ${file}`);
  }
}

main().catch((error) => {
  console.error(`❌ write-blogs 失败: ${error.message}`);
  process.exitCode = 1;
});
