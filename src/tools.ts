import { promises as fs } from 'node:fs'
import { createWriteStream } from 'node:fs'
import https from 'node:https'
import path from 'node:path'

// Web search tool (using a mock implementation - in real usage, integrate with search APIs)
export async function searchWeb(query: string, limit = 5): Promise<Array<{ title: string, url: string, snippet: string }>> {
  // Mock implementation - in real usage, integrate with Google Search API, Bing API, etc.
  const mockResults = [
    {
      title: `Search result for "${query}"`,
      url: `https://example.com/search?q=${encodeURIComponent(query)}`,
      snippet: `This is a mock search result for the query "${query}". In a real implementation, this would return actual search results from a search engine API.`,
    },
  ]

  return mockResults.slice(0, limit)
}

// Download image from URL
export async function downloadImage(url: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(outputPath)

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`))
        return
      }

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        resolve(outputPath)
      })

      file.on('error', (err) => {
        fs.unlink(outputPath).catch(() => {})
        reject(err)
      })
    }).on('error', (err) => {
      reject(err)
    })
  })
}

// Extract content from web page (mock implementation)
export async function scrapeWebContent(url: string): Promise<{ title: string, content: string, images: string[] }> {
  // Mock implementation - in real usage, use puppeteer, cheerio, or similar
  return {
    title: `Content from ${url}`,
    content: `This is mock content scraped from ${url}. In a real implementation, this would extract actual content from the web page using tools like puppeteer or cheerio.`,
    images: [
      `https://example.com/image1.jpg`,
      `https://example.com/image2.jpg`,
    ],
  }
}

// Generate presentation outline from topic
export function generatePresentationOutline(topic: string, duration: number = 30): string[] {
  const slides = Math.max(5, Math.min(20, Math.floor(duration / 2)))
  
  const outline = [
    `Title: ${topic}`,
    'Introduction and Overview',
    'Background and Context',
  ]
  
  // Add content slides based on duration
  const contentSlides = Math.floor(slides * 0.6)
  for (let i = 1; i <= contentSlides; i++) {
    outline.push(`Main Content ${i}`)
  }
  
  outline.push('Key Takeaways')
  outline.push('Conclusion')
  outline.push('Q&A')
  
  return outline.slice(0, slides)
}

// Create table of contents slide
export function createTableOfContents(topics: string[]): string {
  const tocItems = topics.map(topic => `- ${topic}`).join('\n')
  
  return `---
layout: center
---

# Table of Contents

${tocItems}

---
`
}

// Create presentation from outline
export function createPresentationFromOutline(
  title: string,
  author: string,
  outline: string[],
  theme = 'seriph',
): string {
  const slides = [
    `---
theme: ${theme}
title: ${title}
author: ${author}
drawings:
  enabled: true
  persist: false
transition: slide-left
colorSchema: auto
---

# ${title}

A presentation by ${author}

---
`,
    createTableOfContents(outline.slice(1)),
  ]
  
  // Generate content for each outline item
  outline.slice(1).forEach((item, index) => {
    let layout = 'default'
    let content = ''
    
    if (item.toLowerCase().includes('introduction')) {
      layout = 'intro'
      content = `## Welcome

This presentation covers ${title.toLowerCase()}.

### What you'll learn:
- Key concepts and principles
- Practical applications
- Real-world examples`
    } else if (item.toLowerCase().includes('conclusion')) {
      layout = 'statement'
      content = `## Summary

We've covered the essential aspects of ${title.toLowerCase()}.

### Key takeaways:
- Point 1
- Point 2  
- Point 3`
    } else if (item.toLowerCase().includes('q&a')) {
      layout = 'end'
      content = `# Questions?

Thank you for your attention!

Contact: ${author}`
    } else {
      content = `## ${item}

<!-- Add your content for "${item}" here -->

### Key Points:
- Point 1
- Point 2
- Point 3

### Details:
- Additional information
- Supporting evidence
- Examples`
    }
    
    const layoutConfig = layout === 'default' ? '' : `layout: ${layout}\n`
    slides.push(`---
${layoutConfig}---

${content}

---
`)
  })
  
  return slides.join('\n')
}

// Validate slide content
export function validateSlideContent(content: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check for basic markdown structure
  if (!content.includes('---')) {
    errors.push('Missing slide separators (---)')
  }
  
  // Check for frontmatter
  if (!content.startsWith('---')) {
    errors.push('Missing frontmatter at the beginning')
  }
  
  // Check for empty slides
  const slides = content.split('\n---\n')
  slides.forEach((slide, index) => {
    const contentLines = slide.split('\n').filter(line => 
      line.trim() && !line.startsWith('---') && !line.includes(':')
    )
    if (contentLines.length === 0) {
      errors.push(`Slide ${index + 1} appears to be empty`)
    }
  })
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

// Format code block for slides
export function formatCodeBlock(code: string, language: string = 'javascript'): string {
  return `\`\`\`${language}
${code}
\`\`\``
}

// Create comparison slide
export function createComparisonSlide(
  title: string,
  leftTitle: string,
  leftContent: string[],
  rightTitle: string,
  rightContent: string[],
): string {
  const leftItems = leftContent.map(item => `- ${item}`).join('\n')
  const rightItems = rightContent.map(item => `- ${item}`).join('\n')
  
  return `---
layout: two-cols
---

# ${title}

::left::

## ${leftTitle}

${leftItems}

::right::

## ${rightTitle}

${rightItems}

---
`
}

// Generate image slide
export function createImageSlide(
  title: string,
  imagePath: string,
  caption?: string,
  layout: 'image' | 'image-left' | 'image-right' = 'image',
): string {
  const captionText = caption ? `\n\n*${caption}*` : ''
  
  if (layout === 'image') {
    return `---
layout: image
image: ${imagePath}
---

# ${title}${captionText}

---
`
  } else {
    return `---
layout: ${layout}
image: ${imagePath}
---

# ${title}

${captionText}

---
`
  }
} 
