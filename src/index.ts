import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import {
  createComparisonSlide,
  createImageSlide,
  createPresentationFromOutline,
  formatCodeBlock,
  generatePresentationOutline,
  validateSlideContent,
} from './tools.js'

// Helper functions for recommendations
function recommendTheme(topic: string, style?: string): string {
  const topicLower = topic.toLowerCase()
  const styleLower = style?.toLowerCase() || ''

  if (
    styleLower.includes('academic')
    || styleLower.includes('research')
    || topicLower.includes('research')
  ) {
    return 'academic'
  }
  if (
    styleLower.includes('tech')
    || topicLower.includes('tech')
    || topicLower.includes('programming')
    || topicLower.includes('development')
  ) {
    return 'apple-basic'
  }
  if (
    styleLower.includes('creative')
    || styleLower.includes('fun')
    || topicLower.includes('creative')
  ) {
    return 'bricks'
  }
  if (
    styleLower.includes('formal')
    || styleLower.includes('business')
    || topicLower.includes('business')
  ) {
    return 'light'
  }
  if (styleLower.includes('casual') || styleLower.includes('friendly')) {
    return 'penguin'
  }

  // Default recommendation
  return 'seriph'
}

function recommendLayout(description: string): string {
  const descLower = description.toLowerCase()

  if (
    descLower.includes('comparison')
    || descLower.includes('vs')
    || descLower.includes('versus')
  ) {
    return 'two-cols'
  }
  if (descLower.includes('quote') || descLower.includes('saying')) {
    return 'quote'
  }
  if (
    descLower.includes('image')
    || descLower.includes('picture')
    || descLower.includes('photo')
  ) {
    return 'image'
  }
  if (descLower.includes('center') || descLower.includes('focus')) {
    return 'center'
  }
  if (descLower.includes('intro') || descLower.includes('introduction')) {
    return 'intro'
  }
  if (
    descLower.includes('end')
    || descLower.includes('conclusion')
    || descLower.includes('thank')
  ) {
    return 'end'
  }

  return 'default'
}

// Schema definitions
const CreateSlidevProjectSchema = z.object({
  title: z.string().describe('Presentation title'),
  author: z.string().describe('Author name'),
  theme: z
    .string()
    .optional()
    .describe(
      'Specific theme name, if not provided will auto-recommend based on topic',
    ),
  projectPath: z.string().describe('Path where to create the project'),
  language: z.string().optional().describe('Language code (default: en)'),
  useTemplate: z
    .boolean()
    .optional()
    .describe('Whether to use LittleSound talks template (default: false)'),
  style: z
    .string()
    .optional()
    .describe(
      'Style preferences for theme recommendation (e.g., formal, casual, technical)',
    ),
})

const GenerateSlideContentSchema = z.object({
  topic: z.string().describe('Main topic or title of the slide'),
  description: z
    .string()
    .describe('Detailed description of what the slide should contain'),
  layout: z
    .string()
    .optional()
    .describe(
      'Specific layout name, if not provided will auto-recommend based on description',
    ),
  style: z
    .string()
    .optional()
    .describe('Style preferences (e.g., formal, casual, technical)'),
})

const AddSlideSchema = z.object({
  slidesPath: z.string().describe('Path to the slides.md file'),
  slideContent: z
    .string()
    .describe('Content of the new slide in Slidev format'),
  position: z
    .number()
    .optional()
    .describe('Position to insert the slide (default: end)'),
})

const GeneratePresentationSchema = z.object({
  topic: z.string().describe('Main topic of the presentation'),
  author: z.string().describe('Author name'),
  duration: z.number().optional().describe('Duration in minutes (default: 30)'),
  theme: z
    .string()
    .optional()
    .describe(
      'Specific theme name, if not provided will auto-recommend based on topic',
    ),
  outputPath: z.string().describe('Path where to save the presentation'),
  style: z
    .string()
    .optional()
    .describe(
      'Style preferences for theme recommendation (e.g., formal, casual, technical, academic)',
    ),
})

const CreateComparisonSchema = z.object({
  title: z.string().describe('Slide title'),
  leftTitle: z.string().describe('Left column title'),
  leftContent: z.array(z.string()).describe('Left column content items'),
  rightTitle: z.string().describe('Right column title'),
  rightContent: z.array(z.string()).describe('Right column content items'),
})

const CreateImageSlideSchema = z.object({
  title: z.string().describe('Slide title'),
  imagePath: z.string().describe('Path to image file'),
  caption: z.string().optional().describe('Image caption'),
  layout: z
    .enum(['image', 'image-left', 'image-right'])
    .optional()
    .describe('Image layout'),
})

const FormatCodeSchema = z.object({
  code: z.string().describe('Code to format'),
  language: z
    .string()
    .optional()
    .describe('Programming language (default: javascript)'),
})

// Helper function to generate slide content based on topic and layout
function generateSlideContent(
  topic: string,
  layout: string,
  content: string,
): string {
  const layoutConfig = layout === 'default' ? '' : `layout: ${layout}\n`

  return `---
${layoutConfig}---

# ${topic}

${content}

---
`
}

// Template checklist for user guidance
const TEMPLATE_CHECKLIST = `
## 📋 Template Setup Checklist

恭喜！您已经成功使用模板创建了项目。为了完成设置，请按照以下清单进行操作：

- [ ] 更新 \`LICENSE\` 文件中的作者名称
- [ ] 删除 \`.github\` 文件夹（包含资助信息）
- [ ] 使用 \`README-template.md\` 替换 \`README.md\`
- [ ] 复制 \`0000-00-00\` 文件夹并开始创建您的实际演讲内容
- [ ] 查找文件中的 TODO 标签以了解更多信息

🎯 **建议下一步操作：**
1. 导航到项目目录
2. 运行 \`pnpm dev\` 启动开发服务器
3. 在浏览器中查看您的演示文稿
4. 编辑最新日期文件夹中的 \`slides.md\` 文件
5. 按照上述清单完成项目设置

✨ 开始创建您的精彩演示文稿吧！
`

// Create Slidev MCP server
const server = new Server(
  {
    name: 'slidev-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create-slidev-project',
        description:
          'Create a new Slidev presentation project with automatic theme recommendation and optional template support',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Presentation title' },
            author: { type: 'string', description: 'Author name' },
            theme: {
              type: 'string',
              description:
                'Specific theme name, if not provided will auto-recommend based on topic',
            },
            projectPath: {
              type: 'string',
              description: 'Path where to create the project',
            },
            language: {
              type: 'string',
              description: 'Language code (default: en)',
            },
            useTemplate: {
              type: 'boolean',
              description:
                'Whether to use LittleSound talks template (default: false)',
            },
            style: {
              type: 'string',
              description:
                'Style preferences for theme recommendation (e.g., formal, casual, technical, academic)',
            },
          },
          required: ['title', 'author', 'projectPath'],
        },
      },
      {
        name: 'generate-slide-content',
        description:
          'Generate Slidev slide content with automatic layout recommendation based on content description',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Main topic or title of the slide',
            },
            description: {
              type: 'string',
              description:
                'Detailed description of what the slide should contain',
            },
            layout: {
              type: 'string',
              description:
                'Specific layout name, if not provided will auto-recommend based on description',
            },
            style: {
              type: 'string',
              description:
                'Style preferences (e.g., formal, casual, technical)',
            },
          },
          required: ['topic', 'description'],
        },
      },
      {
        name: 'add-slide',
        description: 'Add a new slide to an existing Slidev presentation',
        inputSchema: {
          type: 'object',
          properties: {
            slidesPath: {
              type: 'string',
              description: 'Path to the slides.md file',
            },
            slideContent: {
              type: 'string',
              description: 'Content of the new slide in Slidev format',
            },
            position: {
              type: 'number',
              description: 'Position to insert the slide (default: end)',
            },
          },
          required: ['slidesPath', 'slideContent'],
        },
      },
      {
        name: 'generate-presentation',
        description:
          'Generate a complete Slidev presentation with automatic theme recommendation',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Main topic of the presentation',
            },
            author: { type: 'string', description: 'Author name' },
            duration: {
              type: 'number',
              description: 'Duration in minutes (default: 30)',
            },
            theme: {
              type: 'string',
              description:
                'Specific theme name, if not provided will auto-recommend based on topic',
            },
            outputPath: {
              type: 'string',
              description: 'Path where to save the presentation',
            },
            style: {
              type: 'string',
              description:
                'Style preferences for theme recommendation (e.g., formal, casual, technical, academic)',
            },
          },
          required: ['topic', 'author', 'outputPath'],
        },
      },
      {
        name: 'create-comparison',
        description: 'Create a two-column comparison slide',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Slide title' },
            leftTitle: { type: 'string', description: 'Left column title' },
            leftContent: {
              type: 'array',
              items: { type: 'string' },
              description: 'Left column content items',
            },
            rightTitle: { type: 'string', description: 'Right column title' },
            rightContent: {
              type: 'array',
              items: { type: 'string' },
              description: 'Right column content items',
            },
          },
          required: [
            'title',
            'leftTitle',
            'leftContent',
            'rightTitle',
            'rightContent',
          ],
        },
      },
      {
        name: 'create-image-slide',
        description: 'Create a slide with image layout',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Slide title' },
            imagePath: { type: 'string', description: 'Path to image file' },
            caption: { type: 'string', description: 'Image caption' },
            layout: {
              type: 'string',
              description: 'Image layout',
              enum: ['image', 'image-left', 'image-right'],
            },
          },
          required: ['title', 'imagePath'],
        },
      },
      {
        name: 'format-code',
        description: 'Format code block for use in Slidev slides',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Code to format' },
            language: {
              type: 'string',
              description: 'Programming language (default: javascript)',
            },
          },
          required: ['code'],
        },
      },
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params

    // Debug: log all incoming requests
    console.error(
      'Tool call request:',
      JSON.stringify({ name, args, type: typeof args }, null, 2),
    )

    // Handle case where arguments might be passed as a string or other formats
    let parsedArgs = args

    if (typeof args === 'string') {
      try {
        parsedArgs = JSON.parse(args)
        console.error('Parsed string args:', parsedArgs)
      }
      catch (e) {
        console.error('Failed to parse string arguments:', e)
        // If JSON parsing fails, treat as empty object
        parsedArgs = {}
      }
    }
    else if (args === null || args === undefined) {
      parsedArgs = {}
    }
    else if (typeof args !== 'object') {
      console.error('Unexpected argument type:', typeof args, args)
      parsedArgs = {}
    }

    // Ensure parsedArgs is always an object
    if (typeof parsedArgs !== 'object' || parsedArgs === null) {
      console.error('Converting non-object args to empty object:', parsedArgs)
      parsedArgs = {}
    }

    switch (name) {
      case 'create-slidev-project': {
        const parsed = CreateSlidevProjectSchema.safeParse(parsedArgs)
        if (!parsed.success) {
          throw new Error(
            `Invalid arguments for create-slidev-project: ${parsed.error}`,
          )
        }
        const {
          title,
          author,
          theme,
          projectPath,
          language: _language = 'en',
          useTemplate = false,
          style,
        } = parsed.data

        // Recommend theme if not provided
        const selectedTheme = theme || recommendTheme(title, style)

        try {
          if (useTemplate) {
            // Use template approach
            const { exec } = await import('node:child_process')
            const { promisify } = await import('node:util')
            const execAsync = promisify(exec)

            // Create project directory
            await fs.mkdir(projectPath, { recursive: true })

            // Clone template using degit
            const degitCommand = `npx degit LittleSound/talks-template "${projectPath}"`
            await execAsync(degitCommand)

            // Install dependencies
            const installCommand = 'pnpm i'
            await execAsync(installCommand, { cwd: projectPath })

            // Update package.json with project info
            const packageJsonPath = path.join(projectPath, 'package.json')
            try {
              const packageJsonContent = await fs.readFile(
                packageJsonPath,
                'utf-8',
              )
              const packageJsonData = JSON.parse(packageJsonContent)
              packageJsonData.name = title.toLowerCase().replace(/\s+/g, '-')
              packageJsonData.description = `Presentation: ${title}`
              packageJsonData.author = author
              await fs.writeFile(
                packageJsonPath,
                JSON.stringify(packageJsonData, null, 2),
              )
            }
            catch {
              // package.json might not exist, skip
            }

            // Create new talk folder with current date
            const currentDate = new Date().toISOString().slice(0, 10)
            const templateTalkPath = path.join(projectPath, '0000-00-00')
            const newTalkPath = path.join(projectPath, currentDate)
            try {
              await fs.cp(templateTalkPath, newTalkPath, { recursive: true })

              // Update the slides.md in new talk folder
              const newSlidesMdPath = path.join(newTalkPath, 'slides.md')
              const slidesMdContent = await fs.readFile(
                newSlidesMdPath,
                'utf-8',
              )
              const updatedSlidesMdContent = slidesMdContent
                .replace(/title: .*/g, `title: ${title}`)
                .replace(/author: .*/g, `author: ${author}`)
                .replace(/theme: .*/g, `theme: ${selectedTheme}`)
              await fs.writeFile(newSlidesMdPath, updatedSlidesMdContent)
            }
            catch {
              // Template folder might not exist, skip
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `🎉 Successfully created Slidev project "${title}" from LittleSound talks template!

📁 Project created at: ${projectPath}
🎨 Selected theme: ${selectedTheme}
📅 Talk folder: ${currentDate}

${TEMPLATE_CHECKLIST}`,
                },
              ],
            }
          }
          else {
            // Regular project creation
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
theme: ${selectedTheme}
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
                  text: `🎉 Successfully created Slidev project "${title}" at ${projectPath}

🎨 Recommended theme: ${selectedTheme}
💡 Theme selected based on: ${style ? `style preference (${style})` : 'topic analysis'}

🚀 Next steps:
1. cd ${projectPath}
2. npm install
3. npm run dev
4. Edit slides.md to create your presentation`,
                },
              ],
            }
          }
        }
        catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Error creating project: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          }
        }
      }

      case 'generate-slide-content': {
        const parsed = GenerateSlideContentSchema.safeParse(parsedArgs)
        if (!parsed.success) {
          throw new Error(
            `Invalid arguments for generate-slide-content: ${parsed.error}`,
          )
        }
        const { topic, description, layout } = parsed.data

        // Recommend layout if not provided
        const selectedLayout = layout || recommendLayout(description)

        try {
          // Generate content based on description
          let content = ''

          if (selectedLayout === 'two-cols') {
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
          }
          else if (
            selectedLayout === 'image-left'
            || selectedLayout === 'image-right'
          ) {
            content = `
## ${topic}

${description}

Key highlights:
- Main point 1
- Main point 2
- Main point 3
`
          }
          else if (selectedLayout === 'quote') {
            content = `
> "${description}"

*- Author Name*
`
          }
          else {
            content = `
## Overview

${description}

## Key Points

- Point 1 based on description
- Point 2 derived from content
- Point 3 summarizing main idea
`
          }

          const slideContent = generateSlideContent(
            topic,
            selectedLayout,
            content,
          )

          return {
            content: [
              {
                type: 'text',
                text: `${slideContent}

💡 Recommended layout: ${selectedLayout}
🎯 Layout selected based on: content analysis`,
              },
            ],
          }
        }
        catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Error generating slide content: ${error}`,
              },
            ],
          }
        }
      }

      case 'add-slide': {
        const parsed = AddSlideSchema.safeParse(parsedArgs)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for add-slide: ${parsed.error}`)
        }
        const { slidesPath, slideContent, position } = parsed.data

        try {
          const content = await fs.readFile(slidesPath, 'utf-8')
          const slides = content.split('\n---\n')

          if (position && position < slides.length) {
            slides.splice(position, 0, slideContent)
          }
          else {
            slides.push(slideContent)
          }

          const newContent = slides.join('\n---\n')
          await fs.writeFile(slidesPath, newContent)

          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully added slide to ${slidesPath}`,
              },
            ],
          }
        }
        catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Error adding slide: ${error}`,
              },
            ],
          }
        }
      }

      case 'generate-presentation': {
        console.error(
          'generate-presentation called with parsedArgs:',
          JSON.stringify(parsedArgs, null, 2),
        )
        const parsed = GeneratePresentationSchema.safeParse(parsedArgs)
        if (!parsed.success) {
          console.error(
            'generate-presentation validation failed:',
            JSON.stringify(parsed.error.issues, null, 2),
          )
          return {
            content: [
              {
                type: 'text',
                text: `❌ Invalid arguments for generate-presentation:\n${JSON.stringify(parsed.error.issues, null, 2)}\n\nExpected:\n- topic (string): Main topic\n- author (string): Author name\n- outputPath (string): Where to save\n- duration (number, optional): Duration in minutes\n- theme (string, optional): Theme name`,
              },
            ],
            isError: true,
          }
        }
        const {
          topic,
          author,
          duration = 30,
          theme,
          outputPath,
          style,
        } = parsed.data

        // Recommend theme if not provided
        const selectedTheme = theme || recommendTheme(topic, style)

        try {
          // Generate outline
          const outline = generatePresentationOutline(topic, duration)

          // Create presentation content
          const presentationContent = createPresentationFromOutline(
            topic,
            author,
            outline,
            selectedTheme,
          )

          // Validate content
          const validation = validateSlideContent(presentationContent)

          if (!validation.isValid) {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ Validation errors:\n${validation.errors.join('\n')}`,
                },
              ],
            }
          }

          // Create output directory
          await fs.mkdir(path.dirname(outputPath), { recursive: true })

          // Write presentation file
          await fs.writeFile(outputPath, presentationContent)

          return {
            content: [
              {
                type: 'text',
                text: `🎉 Successfully generated presentation "${topic}" with ${outline.length} slides at ${outputPath}

🎨 Selected theme: ${selectedTheme}
💡 Theme selected based on: ${style ? `style preference (${style})` : 'topic analysis'}
⏱️  Duration: ${duration} minutes`,
              },
            ],
          }
        }
        catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Error generating presentation: ${error}`,
              },
            ],
          }
        }
      }

      case 'create-comparison': {
        const parsed = CreateComparisonSchema.safeParse(parsedArgs)
        if (!parsed.success) {
          throw new Error(
            `Invalid arguments for create-comparison: ${parsed.error}`,
          )
        }
        const { title, leftTitle, leftContent, rightTitle, rightContent }
          = parsed.data

        try {
          const slideContent = createComparisonSlide(
            title,
            leftTitle,
            leftContent,
            rightTitle,
            rightContent,
          )

          return {
            content: [
              {
                type: 'text',
                text: slideContent,
              },
            ],
          }
        }
        catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Error creating comparison slide: ${error}`,
              },
            ],
          }
        }
      }

      case 'create-image-slide': {
        const parsed = CreateImageSlideSchema.safeParse(parsedArgs)
        if (!parsed.success) {
          throw new Error(
            `Invalid arguments for create-image-slide: ${parsed.error}`,
          )
        }
        const { title, imagePath, caption, layout = 'image' } = parsed.data

        try {
          const slideContent = createImageSlide(
            title,
            imagePath,
            caption,
            layout,
          )

          return {
            content: [
              {
                type: 'text',
                text: slideContent,
              },
            ],
          }
        }
        catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Error creating image slide: ${error}`,
              },
            ],
          }
        }
      }

      case 'format-code': {
        const parsed = FormatCodeSchema.safeParse(parsedArgs)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for format-code: ${parsed.error}`)
        }
        const { code, language = 'javascript' } = parsed.data

        try {
          const formattedCode = formatCodeBlock(code, language)

          return {
            content: [
              {
                type: 'text',
                text: formattedCode,
              },
            ],
          }
        }
        catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Error formatting code: ${error}`,
              },
            ],
          }
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    }
  }
})

// Start the server
const transport = new StdioServerTransport()
server.connect(transport)
