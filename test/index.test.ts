import { describe, expect, it } from 'vitest'
import { createPresentationFromOutline, generatePresentationOutline, validateSlideContent } from '../src/tools.js'

describe('slidev MCP Server', () => {
  describe('generatePresentationOutline', () => {
    it('should generate a basic outline', () => {
      const outline = generatePresentationOutline('AI in Healthcare', 30)
      expect(outline).toBeInstanceOf(Array)
      expect(outline.length).toBeGreaterThan(0)
      expect(outline[0]).toContain('AI in Healthcare')
    })

    it('should adjust outline based on duration', () => {
      const shortOutline = generatePresentationOutline('Test Topic', 10)
      const longOutline = generatePresentationOutline('Test Topic', 60)
      expect(shortOutline.length).toBeLessThan(longOutline.length)
    })
  })

  describe('createPresentationFromOutline', () => {
    it('should create presentation content from outline', () => {
      const outline = ['Title: Test', 'Introduction', 'Main Content', 'Conclusion']
      const content = createPresentationFromOutline('Test Presentation', 'Test Author', outline)

      expect(content).toContain('# Test Presentation')
      expect(content).toContain('Test Author')
      expect(content).toContain('Introduction')
      expect(content).toContain('Main Content')
      expect(content).toContain('Conclusion')
    })
  })

  describe('validateSlideContent', () => {
    it('should validate correct slide content', () => {
      const validContent = `---
theme: seriph
---

# Title

Content here

---

# Slide 2

More content

---`

      const result = validateSlideContent(validContent)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect invalid slide content', () => {
      const invalidContent = 'No separators or frontmatter'
      const result = validateSlideContent(invalidContent)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
