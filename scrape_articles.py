"""
爬取 Substack 文章的標題、副標題和圖片
"""
import requests
from bs4 import BeautifulSoup
import json
import re

def scrape_substack_article(url):
    """爬取單篇 Substack 文章資訊"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # 方法1: 從 meta tags 獲取資訊
        title = soup.find('meta', property='og:title')
        title = title['content'] if title else None
        
        image = soup.find('meta', property='og:image')
        image = image['content'] if image else None
        
        # 方法2: 從頁面內容獲取（備用）
        if not title:
            title_tag = soup.find('h1', class_='post-title')
            if title_tag:
                title = title_tag.get_text(strip=True)
        
        return {
            'url': url,
            'title': title,
            'image': image,
            'success': True
        }
    
    except Exception as e:
        print(f"Error scraping {url}: {str(e)}")
        return {
            'url': url,
            'title': None,
            'image': None,
            'success': False,
            'error': str(e)
        }

def main():
    urls = [
        'https://www.jtdatastoryteller.com/p/ai-agent-trends-report-2026',
        'https://www.jtdatastoryteller.com/p/2025-retrospective-ai-career-growth',
        'https://www.jtdatastoryteller.com/p/build-workplace-personal-brand'
    ]
    
    articles = []
    
    print("開始爬取文章資訊...\n")
    
    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}] 爬取: {url}")
        article_data = scrape_substack_article(url)
        articles.append(article_data)
        
        if article_data['success']:
            print(f"  ✓ 標題: {article_data['title']}")
            print(f"  ✓ 圖片: {article_data['image'][:80]}..." if article_data['image'] else "  ✗ 未找到圖片")
        else:
            print(f"  ✗ 爬取失敗: {article_data.get('error', 'Unknown error')}")
        print()
    
    # 儲存結果為 JSON
    output_file = 'articles_data.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    
    print(f"\n結果已儲存至: {output_file}")
    
    # 生成 HTML 代碼
    print("\n" + "="*80)
    print("生成的 HTML 代碼:")
    print("="*80 + "\n")
    
    for i, article in enumerate(articles, 1):
        if article['success']:
            print(f"<!-- Article {i} -->")
            print(f'<div class="FeaturedCard">')
            print(f'  <a href="{article["url"]}" target="_blank" class="FeaturedCardLink">')
            print(f'    <div class="FeaturedImageWrapper">')
            print(f'      <img ')
            print(f'        src="{article["image"]}" ')
            print(f'        alt="{article["title"]}"')
            print(f'        class="FeaturedImage"')
            print(f'      />')
            print(f'    </div>')
            print(f'    <div class="FeaturedContent">')
            print(f'      <h3 class="FeaturedTitle">{article["title"]}</h3>')
            print(f'      <span class="ReadMore">閱讀全文 →</span>')
            print(f'    </div>')
            print(f'  </a>')
            print(f'</div>\n')

if __name__ == '__main__':
    main()
