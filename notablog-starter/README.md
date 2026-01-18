# Notablog 使用指南

> 從 Notion 表格自動生成靜態部落格網站

## 📚 目錄

- [快速開始](#快速開始)
- [工作流程](#工作流程)
- [Notion 欄位說明](#notion-欄位說明)
- [命令說明](#命令說明)
- [常見問題](#常見問題)

---

## 🚀 快速開始

### 1. 設定 Notion 表格

在你的 Notion 中建立一個資料庫（Database），包含以下欄位：

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| title | 標題 | 文章標題（自動） |
| tags | 多選 | 文章標籤 |
| publish | 勾選框 | 是否發布 |
| inMenu | 勾選框 | 是否顯示在導航欄 |
| inList | 勾選框 | 是否顯示在首頁列表 |
| template | 單選 | 使用的模板（通常選 `post`） |
| url | 文字 | 自訂網址（選填） |
| description | 文字 | 文章描述 |
| date | 日期 | 發布日期 |

### 2. 配置 `config.json`

```json
{
  "url": "你的 Notion 資料庫網址",
  "theme": "pure-ejs",
  "autoSlug": true
}
```

---

## 🔄 工作流程

### 📝 新增文章

#### 步驟 1：在 Notion 中建立新頁面

1. 打開你的 Notion 資料庫
2. 點擊「+ New」建立新頁面
3. 填寫文章內容

#### 步驟 2：設定文章屬性

| 欄位 | 設定 | 說明 |
|------|------|------|
| **publish** | ✅ 打勾 | 必須打勾才會發布到網站 |
| **inList** | ✅ 打勾 | 讓文章出現在首頁列表 |
| **inMenu** | ❌ 不勾 | 一般文章不需要 |
| **template** | 選 `post` | 使用文章模板 |
| **date** | 填入日期 | 文章發布日期 |
| **tags** | 選擇標籤 | 文章分類標籤 |
| **url** | 選填 | 自訂網址（留空會自動生成） |
| **description** | 填入描述 | 文章摘要 |

#### 步驟 3：生成網站

```bash
node bin/cli.js generate notablog-starter
```

#### 步驟 4：預覽結果

```bash
node bin/cli.js preview notablog-starter
```

然後打開瀏覽器訪問 `http://localhost:3000`

---

### ✏️ 編輯文章

#### 步驟 1：在 Notion 中修改內容

直接在 Notion 中編輯你的文章內容或屬性

#### 步驟 2：重新生成網站

```bash
node bin/cli.js generate notablog-starter
```

> 💡 **提示**：Notablog 會自動檢測哪些頁面有更新，只重新生成變更的頁面

#### 步驟 3：刷新預覽

如果預覽伺服器還在運行：
- 在瀏覽器中按 `Cmd + Shift + R`（Mac）或 `Ctrl + Shift + R`（Windows）強制刷新

如果預覽伺服器已關閉：
```bash
node bin/cli.js preview notablog-starter
```

---

## 📋 Notion 欄位說明

### 必填欄位

#### 1. **publish** （發布）
- **類型**：勾選框
- **作用**：控制文章是否發布到網站
- **設定**：
  - ✅ 打勾 = 文章會被生成並顯示
  - ❌ 不勾 = 文章不會出現在網站上（草稿狀態）

#### 2. **inList** （顯示在列表）
- **類型**：勾選框
- **作用**：控制文章是否出現在首頁的文章列表
- **設定**：
  - ✅ 打勾 = 文章會出現在首頁列表
  - ❌ 不勾 = 文章不會出現在首頁（但仍可透過直接連結訪問）

#### 3. **inMenu** （顯示在導航欄）
- **類型**：勾選框
- **作用**：控制頁面是否出現在網站導航欄
- **設定**：
  - ✅ 打勾 = 頁面會出現在導航欄（適合 About、Contact 等固定頁面）
  - ❌ 不勾 = 頁面不會出現在導航欄（一般文章）

#### 4. **template** （模板）
- **類型**：單選
- **作用**：指定使用的頁面模板
- **設定**：通常選擇 `post`

### 選填欄位

#### 5. **url** （自訂網址）
- **類型**：文字
- **作用**：自訂文章的網址
- **設定**：
  - **留空**：自動從標題生成網址（推薦）
    - 範例：`從知道到做到...` → `-idp--2eb34b.html`
  - **填入英文**：使用自訂網址
    - 範例：`idp-guide` → `idp-guide.html`
- **注意**：
  - ✅ 只能使用英文、數字、連字號 `-`
  - ❌ 不要使用中文、空格、特殊符號

#### 6. **description** （描述）
- **類型**：文字
- **作用**：文章摘要，會顯示在首頁列表
- **設定**：填入 1-2 句話的文章簡介

#### 7. **date** （日期）
- **類型**：日期
- **作用**：文章發布日期，用於排序
- **設定**：選擇文章的發布日期

#### 8. **tags** （標籤）
- **類型**：多選
- **作用**：文章分類標籤
- **設定**：選擇一個或多個標籤

---

## 🛠️ 命令說明

### `generate` - 生成網站

```bash
node bin/cli.js generate notablog-starter
```

**作用**：
- 從 Notion 抓取最新內容
- 生成靜態 HTML 檔案到 `public/` 目錄
- 下載 Notion 中的圖片到本地

**何時使用**：
- ✅ 在 Notion 中新增文章後
- ✅ 在 Notion 中修改文章內容後
- ✅ 在 Notion 中修改文章屬性（publish、inList 等）後
- ✅ 修改主題樣式後

**執行時間**：
- 首次生成：約 2-5 秒
- 後續更新：約 1-2 秒（只更新變更的頁面）

**輸出範例**：
```
I/notablog: Copy theme assets
I/notablog: Fetch site metadata
I/notablog: Render home page and tags
I/notablog: Fetch and render pages
I/notablog: 1 of 5 posts have been updated
I/notablog: 4 of 5 posts are published
I/notablog-cli: Done in 1.569s
```

---

### `preview` - 預覽網站

```bash
node bin/cli.js preview notablog-starter
```

**作用**：
- 啟動本地開發伺服器
- 在瀏覽器中預覽生成的網站

**何時使用**：
- ✅ 想要在本地查看網站效果
- ✅ 檢查文章是否正確顯示
- ✅ 測試樣式修改

**訪問網址**：
- `http://localhost:3000`

**停止伺服器**：
- 按 `Ctrl + C`

**注意事項**：
- ⚠️ `preview` 只是預覽，不會自動更新內容
- ⚠️ 修改 Notion 後，需要先執行 `generate` 再刷新瀏覽器

---

## 🔄 完整工作流程範例

### 情境 1：發布新文章

```bash
# 1. 在 Notion 中寫好文章，設定好屬性
# 2. 生成網站
node bin/cli.js generate notablog-starter

# 3. 預覽結果
node bin/cli.js preview notablog-starter

# 4. 在瀏覽器中打開 http://localhost:3000 檢查
```

### 情境 2：修改現有文章

```bash
# 1. 在 Notion 中修改文章內容
# 2. 重新生成
node bin/cli.js generate notablog-starter

# 3. 如果預覽伺服器還在運行，直接刷新瀏覽器
# 4. 如果預覽伺服器已關閉，重新啟動
node bin/cli.js preview notablog-starter
```

### 情境 3：修改主題樣式

```bash
# 1. 修改 themes/pure-ejs/assets/css/theme.css
# 2. 重新生成（複製新的 CSS 檔案）
node bin/cli.js generate notablog-starter

# 3. 強制刷新瀏覽器（Cmd + Shift + R）
```

---

## ❓ 常見問題

### Q1: 為什麼我的新文章沒有出現在首頁？

**檢查清單**：
1. ✅ `publish` 欄位是否打勾？
2. ✅ `inList` 欄位是否打勾？
3. ✅ 是否執行了 `generate` 命令？
4. ✅ 瀏覽器是否已刷新？

### Q2: 為什麼圖片無法顯示？

**原因**：Notion 的圖片連結會過期，需要下載到本地

**解決方案**：
```bash
# 清除快取並重新生成
rm -rf notablog-starter/cache
node bin/cli.js generate notablog-starter
```

圖片會被下載到 `public/assets/notion/` 目錄

### Q3: 如何設定自訂網址？

在 Notion 的 `url` 欄位填入想要的網址：

| 設定 | 結果 |
|------|------|
| `url` 留空 | 自動生成：`-idp--2eb34b.html` |
| `url: my-article` | 自訂網址：`my-article.html` |

**建議**：
- 一般文章：留空（自動生成）
- 重要頁面：填入簡短英文（如 `about`、`contact`）

### Q4: 修改 Notion 後多久會更新？

Notablog 是**靜態網站生成器**，不會自動同步。

**流程**：
1. 在 Notion 中修改內容
2. 手動執行 `generate` 命令
3. 網站才會更新

**未來可以**：
- 使用 GitHub Actions 自動化
- 設定定時任務自動生成

### Q5: `generate` 和 `preview` 的區別？

| 命令 | 作用 | 何時使用 |
|------|------|---------|
| `generate` | 從 Notion 抓取內容並生成 HTML | Notion 內容有變更時 |
| `preview` | 啟動本地伺服器預覽網站 | 想要查看網站效果時 |

**記憶口訣**：
- 📝 **內容變了** → `generate`
- 👀 **想看效果** → `preview`

---

## 📁 目錄結構

```
notablog-starter/
├── config.json          # 配置檔案
├── themes/              # 主題目錄
│   └── pure-ejs/       # 當前使用的主題
│       ├── assets/     # CSS、字體等資源
│       └── layouts/    # HTML 模板
├── cache/              # Notion 內容快取
└── public/             # 生成的網站檔案（部署這個目錄）
    ├── index.html      # 首頁
    ├── about.html      # About 頁面
    ├── *.html          # 其他文章頁面
    └── assets/         # 靜態資源
        └── notion/     # 從 Notion 下載的圖片
```

---

## 🎨 自訂主題

主題檔案位於 `themes/pure-ejs/`：

- **CSS 樣式**：`assets/css/theme.css`
- **頁面模板**：`layouts/*.html`
- **部分組件**：`layouts/partials/*.html`

修改後記得執行 `generate` 重新生成。

---

## 📤 部署網站

生成的網站在 `public/` 目錄，可以部署到：

- **GitHub Pages**
- **Netlify**
- **Vercel**
- **任何靜態網站託管服務**

只需要上傳 `public/` 目錄的內容即可。

---

## 💡 提示與技巧

### 1. 使用快取加速生成

Notablog 會快取 Notion 內容，只更新變更的頁面。

如果遇到問題，可以清除快取：
```bash
rm -rf notablog-starter/cache
```

### 2. 批次更新文章

如果同時修改多篇文章，只需執行一次 `generate` 即可。

### 3. 預覽時的即時刷新

預覽伺服器不會自動重新載入，修改後需要：
1. 執行 `generate`
2. 手動刷新瀏覽器

### 4. 檢查生成日誌

`generate` 命令會顯示詳細日誌，包括：
- 更新了幾篇文章
- 發布了幾篇文章
- 是否有錯誤

---

## 🆘 需要幫助？

- 查看 [Notablog 官方文檔](https://github.com/dragonman225/notablog)
- 檢查 `cache/` 目錄中的快取檔案
- 使用 `--verbose` 參數查看詳細日誌：
  ```bash
  node bin/cli.js generate notablog-starter --verbose
  ```
