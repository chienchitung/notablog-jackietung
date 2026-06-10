# Notablog - 從 Notion 生成靜態部落格

> 一個強大的靜態網站生成器，將 Notion 資料庫轉換為精美的部落格網站

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## ✨ 特色功能

- 🚀 **從 Notion 直接生成**：使用 Notion 作為 CMS，無需複雜的後台管理
- 🎨 **可自訂主題**：使用 EJS 模板引擎，輕鬆客製化網站外觀
- ⚡ **快速生成**：智能快取機制，只更新變更的頁面
- 🔗 **內部連結轉換**：自動處理 Notion 內部連結
- 🖼️ **圖片本地化**：自動下載 Notion 圖片到本地
- 🌐 **外部連結支援**：可在 Notion 中設定外部連結，自動跳過渲染
- 📱 **響應式設計**：內建的 pure-ejs 主題支援各種裝置
- 🧹 **自動同步清理**：自動偵測並刪除 Notion 中已移除或取消發布的對應本地檔案

## 📦 安裝

### 前置需求

- Node.js >= 15
- npm 或 yarn

### 從原始碼安裝

```bash
# 克隆專案
git clone https://github.com/chienchitung/notablog-jackietung.git
cd notablog-jackietung

# 安裝依賴
npm install --legacy-peer-deps
```

> 💡 **注意**：`npm run build:module` 只有在修改 `src/` 原始碼後才需要執行，一般使用者無需手動編譯。

## 🚀 快速開始

### 1. 準備 Notion 資料庫

在 Notion 中建立一個資料庫，包含以下欄位：

| 欄位名稱    | 類型   | 說明                           |
| ----------- | ------ | ------------------------------ |
| title       | 標題   | 文章標題（自動）               |
| tags        | 多選   | 文章標籤                       |
| publish     | 勾選框 | 是否發布                       |
| inMenu      | 勾選框 | 是否顯示在導航欄               |
| inList      | 勾選框 | 是否顯示在首頁列表             |
| template    | 單選   | 使用的模板（通常選 `post`）    |
| url         | 文字   | 自訂網址（選填，支援外部連結） |
| description | 文字   | 文章描述                       |
| date        | 日期   | 發布日期                       |

### 2. 建立專案目錄

```bash
# 使用 notablog-starter 作為範本
mkdir my-blog
cd my-blog
```

在專案目錄中建立 `config.json`：

```json
{
  "url": "你的 Notion 資料庫網址",
  "theme": "pure-ejs",
  "autoSlug": true,
  "previewBrowser": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
}
```

> 💡 **說明**：`previewBrowser` 為選填，指定 `npm start` 預覽時自動開啟的瀏覽器路徑。macOS 常見路徑：
>
> - Chrome：`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
> - Safari：`/Applications/Safari.app/Contents/MacOS/Safari`
>
> 若不填此欄位，預覽伺服器仍會正常啟動，手動開啟 `http://localhost:3000` 即可。

### 3. 生成並預覽網站

#### 方式一：使用 npm scripts（推薦）⭐

```bash
# 從 Notion 同步數據並生成網站（不使用緩存）
npm run sync

# 啟動本地預覽伺服器
npm start
```

#### 方式二：使用完整命令

```bash
# 從專案根目錄執行生成命令
node bin/cli.js generate notablog-starter

# 啟動本地預覽伺服器
node bin/cli.js preview notablog-starter
```

執行預覽命令後，打開瀏覽器訪問 **http://localhost:3000** 即可查看您的網站。

**推薦工作流程**：

1. 在 Notion 中修改內容（例如：勾選/取消勾選發布狀態）
2. 執行 `npm run sync` 從 Notion 同步最新數據並重新生成
3. 執行 `npm start` 啟動預覽服務器
4. 在瀏覽器中訪問 `http://localhost:3000` 查看更新後的內容

> 💡 **提示**：
>
> - `npm run sync` 會自動使用 `--fresh` 選項，不使用緩存，確保獲取 Notion 的最新數據
> - 預覽伺服器會持續運行，按 `Ctrl + C` 可停止伺服器
> - 如果只是修改了主題樣式，也需要執行 `npm run sync` 重新生成頁面

## 📖 使用說明

### 命令列工具

#### `generate` - 生成靜態網站

```bash
node bin/cli.js generate <path_to_blog> [options]

選項：
  -v, --verbose    顯示詳細日誌
  --fresh          清除快取重新生成
```

**等同於**：

```bash
npm run sync  # 相當於 node bin/cli.js generate --fresh notablog-starter
```

#### `preview` - 本地預覽

```bash
node bin/cli.js preview <path_to_blog> [options]

選項：
  -v, --verbose    顯示詳細日誌
```

**等同於**：

```bash
npm start  # 相當於 node bin/cli.js preview notablog-starter
```

### Notion 數據同步

Notablog 使用快取機制提高效能，每次執行 `npm run sync` 時會自動帶上 `--fresh` 選項，略過快取強制從 Notion API 重新抓取最新資料。

若需要手動清除快取：

```bash
rm -rf notablog-starter/cache
node bin/cli.js generate notablog-starter
```

### 外部連結功能

在 Notion 的 `url` 欄位中填入完整的 URL（以 `http://` 或 `https://` 開頭），系統會自動識別並跳過渲染，直接使用該連結。

**範例**：

- `url: https://example.com` → 直接連結到外部網站
- `url: my-post` → 生成 `my-post.html`
- `url: ` (留空) → 自動生成網址

### 圖片更新與快取管理

#### 🖼️ 智能圖片管理

當您在 Notion 中替換圖片時，Notablog 會自動處理圖片的下載和清理：

**自動清理被替換的圖片**：

- 系統會追蹤每個頁面使用的圖片
- 當頁面的圖片被替換時，舊圖片會自動刪除
- 不會影響其他頁面的圖片

**更新 Notion 圖片的步驟**：

1. 在 Notion 中替換圖片
2. 編輯頁面內容（例如加個空格再刪除）來觸發 `lastEditedTime` 更新
3. 執行生成命令：
   ```bash
   npm run sync
   ```

**強制重新下載所有圖片**：

如果圖片沒有更新，可以清除快取重新生成：

```bash
# 清除快取
find my-blog/cache -type f -delete

# 重新生成（會下載最新圖片並自動刪除舊圖片）
node bin/cli.js generate my-blog
```

> 💡 **提示**：圖片檔案會儲存在 `<your-blog>/public/assets/notion/` 目錄中，檔名格式為 `{blockId}-{filename}`

#### 🧹 自動同步清理 (Pruning)

Notablog 會自動保持本地檔案與 Notion 的一致性：

- 當您在 Notion 中刪除頁面、取消發布、或更改 URL 時
- 執行 `generate` 命令後，系統會自動識別並刪除 `public/` 中過時的 `.html` 檔案
- 同時也會清理 `public/tag/` 中不再需要的標籤頁面

這確保了您的部署目錄始終保持乾淨，不會累積無用的舊檔案。

## 🛠️ 開發指南

### 專案結構

```
notablog/
├── bin/                  # CLI 執行檔
│   └── cli.js
├── dist/                 # 編譯後的程式碼
│   ├── index.js
│   └── index.esm.js
├── src/                  # 源碼
│   ├── commands/         # CLI 命令
│   ├── utils/            # 工具函數
│   ├── cache.ts          # 快取管理
│   ├── config.ts         # 配置管理
│   ├── parseTable.ts     # Notion 表格解析
│   ├── renderPost.ts     # 文章渲染
│   ├── renderer.ts       # 模板渲染引擎
│   └── templateProvider.ts # 模板提供者
├── notablog-starter/     # 範例部落格
└── package.json
```

### 修改源碼

```bash
# 監聽 src/ TypeScript 原始碼並自動重新編譯（僅修改 notablog 工具本身時使用，與部落格預覽無關）
npm run dev

# 手動編譯一次
npm run build:module

# 執行測試
npm test
```

### 自訂主題

主題檔案位於 `<your-blog>/themes/<theme-name>/`：

```
themes/pure-ejs/
├── manifest.json         # 主題配置
├── assets/              # 靜態資源
│   └── css/
│       └── theme.css
└── layouts/             # 模板檔案
    ├── index.html       # 首頁
    ├── post.html        # 文章頁
    ├── tag.html         # 標籤頁
    └── partials/        # 部分組件
        ├── head.html
        ├── navbar.html
        └── footer.html
```

## 🔧 技術細節

### 核心技術

- **TypeScript** - 型別安全的開發體驗
- **EJS / Squirrelly** - 靈活的模板引擎
- **Notion API** - 透過 notionapi-agent 存取 Notion 資料
- **NAST** - Notion Abstract Syntax Tree，用於處理 Notion 內容

### 主要修改

本專案基於 [dragonman225/notablog](https://github.com/dragonman225/notablog) 並進行了以下改進：

1. **外部連結支援**：在 `parseTable.ts` 和 `renderPost.ts` 中新增外部連結檢測
2. **智能圖片管理**：自動清理被替換的舊圖片，避免累積無用檔案
3. **TypeScript 配置優化**：修正 `tsconfig.json` 的 moduleResolution 設定
4. **渲染引擎修復**：修正 Squirrelly 渲染器的參數問題
5. **專案結構整理**：移除未使用的檔案和重複配置
6. **自動同步清理**：新增 `pruneOrphanedFiles` 邏輯，自動刪除 Notion 中已移除的本地 HTML 檔案

## 📤 部署

### GitHub Pages

1. 生成網站：

```bash
npm run sync
```

2. 部署 `notablog-starter/public/` 目錄到 GitHub Pages

### 其他平台

生成的靜態網站位於 `public/` 目錄，可以部署到：

- Netlify
- Vercel
- Cloudflare Pages
- 任何靜態網站託管服務

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 授權

MIT License - 詳見 [LICENSE](LICENSE) 檔案

## 🙏 致謝

- 原始專案：[dragonman225/notablog](https://github.com/dragonman225/notablog)
- Notion API：[notionapi-agent](https://github.com/dragonman225/notionapi-agent)

---

## 📚 詳細文檔

更多使用說明請參考 `notablog-starter/README.md`
