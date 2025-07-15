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
] as const

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
] as const

// Schema definitions
const CreateSlidevProjectSchema = z.object({
  title: z.string().describe('Presentation title'),
  author: z.string().describe('Author name'),
  theme: z.string().optional().describe('Theme name (default: seriph)'),
  projectPath: z.string().describe('Path where to create the project'),
  language: z.string().optional().describe('Language code (default: en)'),
})

const GenerateSlideContentSchema = z.object({
  topic: z.string().describe('Main topic or title of the slide'),
  description: z.string().describe('Detailed description of what the slide should contain'),
  layout: z.enum(SLIDEV_LAYOUTS).optional().describe('Preferred layout'),
  style: z.string().optional().describe('Style preferences (e.g., formal, casual, technical)'),
})

const AddSlideSchema = z.object({
  slidesPath: z.string().describe('Path to the slides.md file'),
  slideContent: z.string().describe('Content of the new slide in Slidev format'),
  position: z.number().optional().describe('Position to insert the slide (default: end)'),
})

const GeneratePresentationSchema = z.object({
  topic: z.string().describe('Main topic of the presentation'),
  author: z.string().describe('Author name'),
  duration: z.number().optional().describe('Duration in minutes (default: 30)'),
  theme: z.string().optional().describe('Theme to use (default: seriph)'),
  outputPath: z.string().describe('Path where to save the presentation'),
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
  layout: z.enum(['image', 'image-left', 'image-right']).optional().describe('Image layout'),
})

const FormatCodeSchema = z.object({
  code: z.string().describe('Code to format'),
  language: z.string().optional().describe('Programming language (default: javascript)'),
})

const InitFromTemplateSchema = z.object({
  projectName: z.string().describe('Name of the new project/talk'),
  projectPath: z.string().describe('Path where to create the project'),
  authorName: z.string().describe('Author name for the project'),
})

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
        description: 'Create a new Slidev presentation project with specified configuration',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Presentation title' },
            author: { type: 'string', description: 'Author name' },
            theme: { type: 'string', description: 'Theme name (default: seriph)' },
            projectPath: { type: 'string', description: 'Path where to create the project' },
            language: { type: 'string', description: 'Language code (default: en)' },
          },
          required: ['title', 'author', 'projectPath'],
        },
      },
      {
        name: 'generate-slide-content',
        description: 'Generate Slidev slide content based on topic description and requirements',
        inputSchema: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Main topic or title of the slide' },
            description: { type: 'string', description: 'Detailed description of what the slide should contain' },
            layout: { type: 'string', description: 'Preferred layout', enum: SLIDEV_LAYOUTS },
            style: { type: 'string', description: 'Style preferences (e.g., formal, casual, technical)' },
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
            slidesPath: { type: 'string', description: 'Path to the slides.md file' },
            slideContent: { type: 'string', description: 'Content of the new slide in Slidev format' },
            position: { type: 'number', description: 'Position to insert the slide (default: end)' },
          },
          required: ['slidesPath', 'slideContent'],
        },
      },
      {
        name: 'list-layouts',
        description: 'List all available Slidev layouts',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'list-themes',
        description: 'List all available Slidev themes',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'generate-presentation',
        description: 'Generate a complete Slidev presentation from a topic and duration',
        inputSchema: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Main topic of the presentation' },
            author: { type: 'string', description: 'Author name' },
            duration: { type: 'number', description: 'Duration in minutes (default: 30)' },
            theme: { type: 'string', description: 'Theme to use (default: seriph)' },
            outputPath: { type: 'string', description: 'Path where to save the presentation' },
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
            leftContent: { type: 'array', items: { type: 'string' }, description: 'Left column content items' },
            rightTitle: { type: 'string', description: 'Right column title' },
            rightContent: { type: 'array', items: { type: 'string' }, description: 'Right column content items' },
          },
          required: ['title', 'leftTitle', 'leftContent', 'rightTitle', 'rightContent'],
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
            layout: { type: 'string', description: 'Image layout', enum: ['image', 'image-left', 'image-right'] },
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
            language: { type: 'string', description: 'Programming language (default: javascript)' },
          },
          required: ['code'],
        },
      },
      {
        name: 'init-from-template',
        description: 'Initialize a new Slidev project from LittleSound talks template',
        inputSchema: {
          type: 'object',
          properties: {
            projectName: { type: 'string', description: 'Name of the new project/talk' },
            projectPath: { type: 'string', description: 'Path where to create the project' },
            authorName: { type: 'string', description: 'Author name for the project' },
          },
          required: ['projectName', 'projectPath', 'authorName'],
        },
      },
      {
        name: 'test-args',
        description: 'Test tool to debug argument passing',
        inputSchema: {
          type: 'object',
          properties: {
            testParam: { type: 'string', description: 'A test parameter' },
          },
          required: [],
        },
      },
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params

    // Debug: log all incoming requests
    console.error('Tool call request:', JSON.stringify({ name, args, type: typeof args }, null, 2))

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
    } else if (args === null || args === undefined) {
      parsedArgs = {}
    } else if (typeof args !== 'object') {
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
          throw new Error(`Invalid arguments for create-slidev-project: ${parsed.error}`)
        }
        const { title, author, theme = 'seriph', projectPath, language: _language = 'en' } = parsed.data

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
      }

      case 'generate-slide-content': {
        const parsed = GenerateSlideContentSchema.safeParse(parsedArgs)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for generate-slide-content: ${parsed.error}`)
        }
        const { topic, description, layout = 'default' } = parsed.data

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
          }
          else if (layout === 'image-left' || layout === 'image-right') {
            content = `
## ${topic}

${description}

Key highlights:
- Main point 1
- Main point 2
- Main point 3
`
          }
          else if (layout === 'quote') {
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
      }

      case 'list-layouts': {
        console.error('list-layouts called with args:', parsedArgs)
        return {
          content: [{
            type: 'text',
            text: `Available Slidev layouts:\n${SLIDEV_LAYOUTS.map(layout => `- ${layout}`).join('\n')}`,
          }],
        }
      }

      case 'list-themes': {
        return {
          content: [{
            type: 'text',
            text: `Available Slidev themes:\n${SLIDEV_THEMES.map(theme => `- ${theme}`).join('\n')}`,
          }],
        }
      }

      case 'generate-presentation': {
        console.error('generate-presentation called with parsedArgs:', JSON.stringify(parsedArgs, null, 2))
        const parsed = GeneratePresentationSchema.safeParse(parsedArgs)
        if (!parsed.success) {
          console.error('generate-presentation validation failed:', JSON.stringify(parsed.error.issues, null, 2))
          return {
            content: [{
              type: 'text',
              text: `❌ Invalid arguments for generate-presentation:\n${JSON.stringify(parsed.error.issues, null, 2)}\n\nExpected:\n- topic (string): Main topic\n- author (string): Author name\n- outputPath (string): Where to save\n- duration (number, optional): Duration in minutes\n- theme (string, optional): Theme name`,
            }],
            isError: true,
          }
        }
        const { topic, author, duration = 30, theme = 'seriph', outputPath } = parsed.data

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
      }

      case 'create-comparison': {
        const parsed = CreateComparisonSchema.safeParse(parsedArgs)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for create-comparison: ${parsed.error}`)
        }
        const { title, leftTitle, leftContent, rightTitle, rightContent } = parsed.data

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
      }

      case 'create-image-slide': {
        const parsed = CreateImageSlideSchema.safeParse(parsedArgs)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for create-image-slide: ${parsed.error}`)
        }
        const { title, imagePath, caption, layout = 'image' } = parsed.data

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
      }

      case 'init-from-template': {
        // Debug: log the received arguments
        console.error('Received args for init-from-template:', JSON.stringify(parsedArgs, null, 2))

        const parsed = InitFromTemplateSchema.safeParse(parsedArgs)
        if (!parsed.success) {
          console.error('Validation failed:', parsed.error)
          throw new Error(`Invalid arguments for init-from-template: ${JSON.stringify(parsed.error.issues, null, 2)}`)
        }
        const { projectName, projectPath, authorName } = parsed.data

        try {
          // Import required modules for subprocess execution
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

          // Execute checklist items

          // 1. Change the author name in LICENSE
          const licensePath = path.join(projectPath, 'LICENSE')
          try {
            const licenseContent = await fs.readFile(licensePath, 'utf-8')
            const updatedLicense = licenseContent.replace(/Copyright \(c\) \d{4} .*/g, `Copyright (c) ${new Date().getFullYear()} ${authorName}`)
            await fs.writeFile(licensePath, updatedLicense)
          }
          catch {
            // LICENSE file might not exist, skip
          }

          // 2. Remove the .github folder
          const githubPath = path.join(projectPath, '.github')
          try {
            await fs.rm(githubPath, { recursive: true, force: true })
          }
          catch {
            // .github folder might not exist, skip
          }

          // 3. Use README-template.md to replace README.md
          const readmeTemplatePath = path.join(projectPath, 'README-template.md')
          const readmePath = path.join(projectPath, 'README.md')
          try {
            await fs.copyFile(readmeTemplatePath, readmePath)
            await fs.unlink(readmeTemplatePath)
          }
          catch {
            // Template might not exist, skip
          }

          // 4. Copy the 0000-00-00 folder and create new talk folder
          const templateTalkPath = path.join(projectPath, '0000-00-00')
          const newTalkPath = path.join(projectPath, new Date().toISOString().slice(0, 10))
          try {
            await fs.cp(templateTalkPath, newTalkPath, { recursive: true })
          }
          catch {
            // Template folder might not exist, skip
          }

          // Update the main slides.md in new talk folder
          const newSlidesMdPath = path.join(newTalkPath, 'slides.md')
          try {
            const slidesMdContent = await fs.readFile(newSlidesMdPath, 'utf-8')
            const updatedSlidesMdContent = slidesMdContent
              .replace(/title: .*/g, `title: ${projectName}`)
              .replace(/author: .*/g, `author: ${authorName}`)
            await fs.writeFile(newSlidesMdPath, updatedSlidesMdContent)
          }
          catch {
            // slides.md might not exist in template, skip
          }

          // Update package.json with project info
          const packageJsonPath = path.join(projectPath, 'package.json')
          try {
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8')
            const packageJsonData = JSON.parse(packageJsonContent)
            packageJsonData.name = projectName.toLowerCase().replace(/\s+/g, '-')
            packageJsonData.description = `Presentation: ${projectName}`
            packageJsonData.author = authorName
            await fs.writeFile(packageJsonPath, JSON.stringify(packageJsonData, null, 2))
          }
          catch {
            // package.json might not exist, skip
          }

          const successMessage = `🎉 Successfully initialized Slidev project "${projectName}" from LittleSound talks template!

✅ Checklist completed:
- ✅ Updated author name in LICENSE
- ✅ Removed .github folder
- ✅ Replaced README.md with template
- ✅ Created new talk folder: ${new Date().toISOString().slice(0, 10)}
- ✅ Updated project information

📁 Project created at: ${projectPath}

🚀 Next steps:
1. cd ${projectPath}
2. pnpm dev (to start the development server)
3. Open your browser and see your presentation
4. Edit the slides in ${new Date().toISOString().slice(0, 10)}/slides.md
5. Look for TODO tags in files to learn more

Enjoy creating your presentation! 🎊`

          return {
            content: [{
              type: 'text',
              text: successMessage,
            }],
          }
        }
        catch (error) {
          return {
            content: [{
              type: 'text',
              text: `❌ Error initializing from template: ${error instanceof Error ? error.message : String(error)}

Please make sure you have:
- Node.js installed
- pnpm installed (npm install -g pnpm)
- Internet connection for downloading template`,
            }],
          }
        }
      }

      case 'test-args': {
        console.error('test-args called with original args:', JSON.stringify(args, null, 2))
        console.error('test-args called with parsedArgs:', JSON.stringify(parsedArgs, null, 2))
        return {
          content: [{
            type: 'text',
            text: `🔍 Debug Info:
Original args type: ${typeof args}
Original args: ${JSON.stringify(args, null, 2)}
Parsed args type: ${typeof parsedArgs}
Parsed args: ${JSON.stringify(parsedArgs, null, 2)}`,
          }],
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
