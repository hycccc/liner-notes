---
name: auto-blog
description: Agent-written daily blog. Fetches trending topics from several news sources, then generates posts in four categories (tech / music / world / production-gear) as markdown files the site picks up automatically. Trigger words - auto-blog, daily blog, generate posts.
---

# auto-blog

An optional pipeline that keeps the blog alive without you: one script fetches candidate topics, an LLM agent writes the posts, and the site renders whatever lands in `posts/`.

## Quick use

- Fetch topics: `node skills/auto-blog/scripts/fetch-news.js` (run from the repo root)
- Write posts: `node skills/auto-blog/scripts/write-blogs.js`
- Full run: `bash skills/auto-blog/scripts/auto-blog.sh`

## Where things live

- Topic cache: `tmp/topics.json` (overwritten each run)
- Generated posts: `posts/YYYY-MM-DD-{category}-{index}.md`
- Publish: run `scripts/deploy.sh` or trigger from `/admin`

## Categories

- `tech`: Hacker News front page
- `music`: Pitchfork + Rolling Stone RSS
- `social`: BBC World RSS
- `midifan`: music-production/gear RSS (swap for your favorite source)

## Division of labor

- `fetch-news.js` needs network access; run it with any agent or plain node + cron
- `write-blogs.js` shells out to an LLM CLI to draft the posts — point `runCodexExec` at whichever agent CLI you use (Claude Code, etc.)

Every generated post is stamped `aiGenerated: true` in its frontmatter, and the site shows that label — readers deserve to know.

## Cron example (daily at 09:00)

```cron
0 9 * * * cd /path/to/your-site && bash skills/auto-blog/scripts/auto-blog.sh >> tmp/auto-blog-cron.log 2>&1
```
