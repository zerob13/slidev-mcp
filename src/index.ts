import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import {
  createComparisonSlide,
  createImageSlide,
  createPresentationFromOutline,
  formatCodeBlock,
  generatePresentationOutline,
  scrapeWebContent,
  searchWeb,
  validateSlideContent
} from './tools.js'

// Available Slidev layouts
const SLIDEV_LAYOUTS = [
  'default',
  'center',
  'cover',
  'end',
  'fact',
  'full',
  'image',
  'image-left',
  'image-right',
  'iframe',
  'iframe-left',
  'iframe-right',
  'intro',
  'none',
  'quote',
  'section',
  'statement',
  'two-cols',
  'two-cols-header',
]

// Available themes
const SLIDEV_THEMES = [
  'seriph',
  'default',
  'apple-basic',
  'bricks',
  'light',
  'academic',
  'eloc',
  'penguin',
  'shibainu',
]

// Helper function to generate slide content based on topic and layout
function generateSlideContent(topic: string, layout: string, content: string): string {
  const layoutConfig = layout === 'default' ? '' : `layout: ${layout}\n`
  
  return `---
${layoutConfig}---

# ${topic}

${content}

---
`
}

// Create Slidev MCP server
const server = new McpServer({
  name: 'slidev-mcp-server',
  version: '1.0.0',
})

// Create a new Slidev presentation project
server.registerTool('create-slidev-project', {
  title: 'Create Slidev Project',
  description: 'Create a new Slidev presentation project with specified configuration',
  inputSchema: {
    title: z.string().describe('Presentation title'),
    author: z.string().describe('Author name'),
    theme: z.string().optional().describe('Theme name (default: seriph)'),
    projectPath: z.string().describe('Path where to create the project'),
    language: z.string().optional().describe('Language code (default: en)'),
  },
}, async ({ title, author, theme = 'seriph', projectPath, language: _language = 'en' }) => {
  try {
    // Create project directory
    await fs.mkdir(projectPath, { recursive: true })

    // Create package.json
    const packageJson = {
      name: title.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: `Presentation: ${title}`,
      author,
      scripts: {
        dev: 'slidev',
        build: 'slidev build',
        export: 'slidev export',
      },
      dependencies: {
        '@slidev/cli': '^0.49.0',
        '@slidev/theme-seriph': '^0.23.0',
      },
    }

    await fs.writeFile(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    )

    // Create basic slides.md
    const slidesContent = `---
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
layout: center
---

# Table of Contents

- Introduction
- Main Content
- Conclusion
- Q&A

---

# Introduction

<!-- Add your introduction content here -->

---

# Main Content

<!-- Add your main content here -->

---

# Conclusion

<!-- Add your conclusion here -->

---
layout: end
---

# Thank You

Questions?
`

    await fs.writeFile(
      path.join(projectPath, 'slides.md'),
      slidesContent,
    )

    return {
      content: [
        {
          type: 'text',
          text: `Successfully created Slidev project "${title}" at ${projectPath}`,
        },
      ],
    }
  }
  catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error creating project: ${error}`,
        },
      ],
    }
  }
})

// Generate slide content from description
server.registerTool('generate-slide-content', {
  title: 'Generate Slide Content',
  description: 'Generate Slidev slide content based on topic description and requirements',
  inputSchema: {
    topic: z.string().describe('Main topic or title of the slide'),
    description: z.string().describe('Detailed description of what the slide should contain'),
    layout: z.enum(SLIDEV_LAYOUTS as [string, ...string[]]).optional().describe('Preferred layout'),
    style: z.string().optional().describe('Style preferences (e.g., formal, casual, technical)'),
  },
}, async ({ topic, description, layout = 'default', style = 'professional' }) => {
  try {
    // Generate content based on description
    let content = ''
    
    if (layout === 'two-cols') {
      content = `
::left::

## Key Points

- ${description.split(' ').slice(0, 10).join(' ')}...

::right::

## Details

- Additional information here
- Supporting details
- Examples and use cases
`
    } else if (layout === 'image-left' || layout === 'image-right') {
      content = `
## ${topic}

${description}

Key highlights:
- Main point 1
- Main point 2
- Main point 3
`
    } else if (layout === 'quote') {
      content = `
> "${description}"

*- Author Name*
`
    } else {
      content = `
## Overview

${description}

## Key Points

- Point 1 based on description
- Point 2 derived from content
- Point 3 summarizing main idea
`
    }
    
    const slideContent = generateSlideContent(topic, layout, content)
    
    return {
      content: [{
        type: 'text',
        text: slideContent,
      }],
    }
  }
  catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error generating slide content: ${error}`,
      }],
    }
  }
})

// Add slide to existing presentation
server.registerTool('add-slide', {
  title: 'Add Slide',
  description: 'Add a new slide to an existing Slidev presentation',
  inputSchema: {
    slidesPath: z.string().describe('Path to the slides.md file'),
    slideContent: z.string().describe('Content of the new slide in Slidev format'),
    position: z.number().optional().describe('Position to insert the slide (default: end)'),
  },
}, async ({ slidesPath, slideContent, position }) => {
  try {
    const content = await fs.readFile(slidesPath, 'utf-8')
    const slides = content.split('\n---\n')
    
    if (position && position < slides.length) {
      slides.splice(position, 0, slideContent)
    } else {
      slides.push(slideContent)
    }
    
    const newContent = slides.join('\n---\n')
    await fs.writeFile(slidesPath, newContent)
    
    return {
      content: [{
        type: 'text',
        text: `Successfully added slide to ${slidesPath}`,
      }],
    }
  }
  catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error adding slide: ${error}`,
      }],
    }
  }
})

// List available layouts
server.registerTool('list-layouts', {
  title: 'List Layouts',
  description: 'List all available Slidev layouts',
  inputSchema: {},
}, async () => {
  return {
    content: [{
      type: 'text',
      text: `Available Slidev layouts:\n${SLIDEV_LAYOUTS.map(layout => `- ${layout}`).join('\n')}`,
    }],
  }
})

// List available themes
server.registerTool('list-themes', {
  title: 'List Themes',
  description: 'List all available Slidev themes',
  inputSchema: {},
}, async () => {
  return {
    content: [{
      type: 'text',
      text: `Available Slidev themes:\n${SLIDEV_THEMES.map(theme => `- ${theme}`).join('\n')}`,
    }],
  }
})

// Generate presentation from topic
server.registerTool('generate-presentation', {
  title: 'Generate Presentation',
  description: 'Generate a complete Slidev presentation from a topic and duration',
  inputSchema: {
    topic: z.string().describe('Main topic of the presentation'),
    author: z.string().describe('Author name'),
    duration: z.number().optional().describe('Duration in minutes (default: 30)'),
    theme: z.string().optional().describe('Theme to use (default: seriph)'),
    outputPath: z.string().describe('Path where to save the presentation'),
  },
}, async ({ topic, author, duration = 30, theme = 'seriph', outputPath }) => {
  try {
    // Generate outline
    const outline = generatePresentationOutline(topic, duration)
    
    // Create presentation content
    const presentationContent = createPresentationFromOutline(topic, author, outline, theme)
    
    // Validate content
    const validation = validateSlideContent(presentationContent)
    
    if (!validation.isValid) {
      return {
        content: [{
          type: 'text',
          text: `Validation errors:\n${validation.errors.join('\n')}`,
        }],
      }
    }
    
    // Create output directory
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    
    // Write presentation file
    await fs.writeFile(outputPath, presentationContent)
    
    return {
      content: [{
        type: 'text',
        text: `Successfully generated presentation "${topic}" with ${outline.length} slides at ${outputPath}`,
      }],
    }
  }
  catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error generating presentation: ${error}`,
      }],
    }
  }
})

// Search web for presentation content
server.registerTool('search-content', {
  title: 'Search Web Content',
  description: 'Search the web for content related to presentation topic',
  inputSchema: {
    query: z.string().describe('Search query'),
    limit: z.number().optional().describe('Maximum number of results (default: 5)'),
  },
}, async ({ query, limit = 5 }) => {
  try {
    const results = await searchWeb(query, limit)
    
    const formattedResults = results.map(result => 
      `**${result.title}**\nURL: ${result.url}\nSnippet: ${result.snippet}\n`
    ).join('\n---\n')
    
    return {
      content: [{
        type: 'text',
        text: `Search results for "${query}":\n\n${formattedResults}`,
      }],
    }
  }
  catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error searching content: ${error}`,
      }],
    }
  }
})

// Scrape web content
server.registerTool('scrape-content', {
  title: 'Scrape Web Content',
  description: 'Extract content from a web page for presentation use',
  inputSchema: {
    url: z.string().describe('URL to scrape'),
  },
}, async ({ url }) => {
  try {
    const content = await scrapeWebContent(url)
    
    const formattedContent = `**${content.title}**\n\n${content.content}\n\n**Images found:**\n${content.images.map(img => `- ${img}`).join('\n')}`
    
    return {
      content: [{
        type: 'text',
        text: formattedContent,
      }],
    }
  }
  catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error scraping content: ${error}`,
      }],
    }
  }
})

// Create comparison slide
server.registerTool('create-comparison', {
  title: 'Create Comparison Slide',
  description: 'Create a two-column comparison slide',
  inputSchema: {
    title: z.string().describe('Slide title'),
    leftTitle: z.string().describe('Left column title'),
    leftContent: z.array(z.string()).describe('Left column content items'),
    rightTitle: z.string().describe('Right column title'),
    rightContent: z.array(z.string()).describe('Right column content items'),
  },
}, async ({ title, leftTitle, leftContent, rightTitle, rightContent }) => {
  try {
    const slideContent = createComparisonSlide(title, leftTitle, leftContent, rightTitle, rightContent)
    
    return {
      content: [{
        type: 'text',
        text: slideContent,
      }],
    }
  }
  catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error creating comparison slide: ${error}`,
      }],
    }
  }
})

// Create image slide
server.registerTool('create-image-slide', {
  title: 'Create Image Slide',
  description: 'Create a slide with image layout',
  inputSchema: {
    title: z.string().describe('Slide title'),
    imagePath: z.string().describe('Path to image file'),
    caption: z.string().optional().describe('Image caption'),
    layout: z.enum(['image', 'image-left', 'image-right']).optional().describe('Image layout'),
  },
}, async ({ title, imagePath, caption, layout = 'image' }) => {
  try {
    const slideContent = createImageSlide(title, imagePath, caption, layout)
    
    return {
      content: [{
        type: 'text',
        text: slideContent,
      }],
    }
  }
  catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error creating image slide: ${error}`,
      }],
    }
  }
})

// Format code for slides
server.registerTool('format-code', {
  title: 'Format Code Block',
  description: 'Format code block for use in Slidev slides',
  inputSchema: {
    code: z.string().describe('Code to format'),
    language: z.string().optional().describe('Programming language (default: javascript)'),
  },
}, async ({ code, language = 'javascript' }) => {
  try {
    const formattedCode = formatCodeBlock(code, language)
    
    return {
      content: [{
        type: 'text',
        text: formattedCode,
      }],
    }
  }
  catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error formatting code: ${error}`,
      }],
    }
  }
})

// Start the server
const transport = new StdioServerTransport()
server.connect(transport)
