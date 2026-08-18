# 新闻源与配置说明

## 全局配置

- 分类：`tech` / `music` / `social` / `midifan`
- 每类目标选题数：`3`（总计 `12`）
- 选题文件输出：`the repo root/tmp/topics.json`（覆盖写入）
- 去重规则：`title + url` 组合去重
- 选题逻辑：按热度分数排序后取前 `3`（同分按发布时间新到旧）

## 热度计算逻辑（取热度前 3）

- HN（`tech`）：`points = (HN points * 2) + comment 数`
- RSS（`music` / `social` / `midifan`）：`points = comment 数 + 时效分`
- 时效分：24h 内 `+35`，72h 内 `+25`，7 天内 `+10`
- 最终对候选项按 `points DESC, publishedAt DESC` 排序并截断到 3 条

## 新闻源 URL

### tech

- Hacker News API（主）：`https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30`
- Hacker News RSS（备用）：`https://hnrss.org/frontpage?count=30`
- 备用话题来源：
  - `https://huggingface.co/blog`
  - `https://developer.chrome.com/blog/`
  - `https://www.cncf.io/blog/`

### music

- Pitchfork RSS（主）：`https://pitchfork.com/rss/news/feed.xml`
- Pitchfork RSS（备用）：`https://pitchfork.com/feed/rss/news/`
- Rolling Stone（配置中作为音乐源参考）：`https://www.rollingstone.com/music/music-news/feed/`
- 备用话题来源：
  - `https://pitchfork.com/news/`
  - `https://www.billboard.com/music/`
  - `https://www.rollingstone.com/music/music-news/`

### social

- BBC World RSS（主）：`https://feeds.bbci.co.uk/news/world/rss.xml`
- BBC Top RSS（备用）：`https://feeds.bbci.co.uk/news/rss.xml`
- 备用话题来源：
  - `https://www.bbc.com/news/world`
  - `https://www.reuters.com/world/`
  - `https://www.theguardian.com/world`

### midifan

- Midifan News RSS：`https://www.midifan.com/rss-news.htm`
- Midifan Hardware RSS：`https://www.midifan.com/rss-hardware.htm`
- Midifan Software RSS：`https://www.midifan.com/rss-software.htm`
- 备用话题来源：
  - `https://www.midifan.com/`
  - `https://www.midifan.com/modulearticle-index.htm`
  - `https://www.midifan.com/modulearticle-cat-8.htm`
