# Slidev MCP Server

一个基于Model Context Protocol (MCP) 的Slidev演讲PPT生成服务器，帮助用户通过AI语言快速创建美观有效的演讲幻灯片。

## 功能特性

### 🎯 核心功能
- **快速项目创建**: 一键创建完整的Slidev演讲项目
- **AI内容生成**: 基于主题描述自动生成演讲内容
- **智能布局选择**: 根据内容类型自动推荐合适的布局
- **多样化模板**: 支持多种预设演讲模板

### 🔧 工具集合
- **内容生成工具**: 根据主题和描述生成幻灯片内容
- **模板初始化**: 从专业模板快速启动项目
- **图片处理工具**: 处理和优化演讲中的图片
- **代码格式化**: 为技术演讲格式化代码块
- **对比幻灯片**: 创建双栏对比展示
- **布局管理**: 提供多种专业布局选择

### 📐 布局支持
支持所有Slidev内置布局：
- `default` - 基础布局
- `center` - 居中布局
- `cover` - 封面布局
- `two-cols` - 双栏布局
- `image-left/right` - 图片布局
- `quote` - 引用布局
- `section` - 章节布局
- 以及更多...

### 🎨 主题支持
- `seriph` (默认)
- `apple-basic`
- `academic`
- `bricks`
- `light`
- 等多种主题

## 安装与配置

### 1. 安装依赖
```bash
pnpm install
```

### 2. 构建项目
```bash
pnpm build
```

### 3. 运行服务器
```bash
pnpm start
```

## 可用工具

### 📝 基础工具

#### `create-slidev-project`
创建新的Slidev演讲项目
```typescript
{
  title: string,          // 演讲标题
  author: string,         // 作者姓名
  theme?: string,         // 主题名称 (默认: seriph)
  projectPath: string,    // 项目路径
  language?: string       // 语言代码 (默认: en)
}
```

#### `generate-presentation`
从主题生成完整演讲
```typescript
{
  topic: string,          // 演讲主题
  author: string,         // 作者姓名
  duration?: number,      // 时长(分钟) (默认: 30)
  theme?: string,         // 主题 (默认: seriph)
  outputPath: string      // 输出路径
}
```

### 🎬 内容生成工具

#### `generate-slide-content`
生成特定幻灯片内容
```typescript
{
  topic: string,          // 幻灯片主题
  description: string,    // 详细描述
  layout?: string,        // 布局选择
  style?: string          // 风格偏好
}
```

#### `add-slide`
向现有演讲添加幻灯片
```typescript
{
  slidesPath: string,     // slides.md文件路径
  slideContent: string,   // 幻灯片内容
  position?: number       // 插入位置
}
```

### 🚀 项目初始化

#### `init-from-template`
从 LittleSound talks 模板初始化新项目
```typescript
{
  projectName: string,    // 项目名称
  projectPath: string,    // 项目路径
  authorName: string      // 作者名称
}
```

这个工具会：
- 使用 `npx degit LittleSound/talks-template` 克隆模板
- 自动安装依赖 (`pnpm i`)
- 执行所有必要的初始化步骤：
  - 更新 LICENSE 中的作者信息
  - 删除 .github 文件夹
  - 用模板替换 README.md
  - 创建新的演讲文件夹（以当前日期命名）
  - 更新项目信息

完成后提醒用户运行 `pnpm dev` 启动开发服务器。

### 🎨 布局工具

#### `create-comparison`
创建对比幻灯片
```typescript
{
  title: string,          // 幻灯片标题
  leftTitle: string,      // 左栏标题
  leftContent: string[],  // 左栏内容
  rightTitle: string,     // 右栏标题
  rightContent: string[]  // 右栏内容
}
```

#### `create-image-slide`
创建图片幻灯片
```typescript
{
  title: string,          // 幻灯片标题
  imagePath: string,      // 图片路径
  caption?: string,       // 图片说明
  layout?: 'image' | 'image-left' | 'image-right'
}
```

### 🔧 实用工具

#### `format-code`
格式化代码块
```typescript
{
  code: string,           // 代码内容
  language?: string       // 编程语言
}
```

#### `list-layouts`
列出所有可用布局

#### `list-themes`
列出所有可用主题

## 使用示例

### 创建一个新的演讲项目
```bash
# 通过MCP客户端调用
create-slidev-project {
  "title": "人工智能在现代医疗中的应用",
  "author": "张三",
  "theme": "academic",
  "projectPath": "./my-ai-presentation"
}
```

### 生成完整演讲
```bash
generate-presentation {
  "topic": "机器学习基础",
  "author": "李四",
  "duration": 45,
  "theme": "seriph",
  "outputPath": "./presentations/ml-basics.md"
}
```

### 添加对比幻灯片
```bash
create-comparison {
  "title": "传统方法 vs 机器学习",
  "leftTitle": "传统方法",
  "leftContent": ["规则驱动", "人工特征工程", "有限的适应性"],
  "rightTitle": "机器学习",
  "rightContent": ["数据驱动", "自动特征学习", "强适应性"]
}
```

## 项目结构

```
slidev-mcp/
├── src/
│   ├── index.ts          # 主MCP服务器
│   └── tools.ts          # 工具函数集合
├── test/
│   └── index.test.ts     # 测试文件
├── scripts/
│   └── verifyCommit.ts   # 提交验证脚本
├── package.json
├── tsconfig.json
└── README.md
```

## 技术栈

- **TypeScript**: 类型安全的JavaScript
- **Model Context Protocol**: AI代理通信协议
- **Slidev**: 现代化的演讲幻灯片框架
- **Node.js**: 运行时环境
- **Zod**: 类型验证

## 开发计划

- [x] 基础项目创建功能
- [x] AI内容生成工具
- [x] 网络搜索和抓取工具
- [x] 布局管理和主题支持
- [x] 多种幻灯片类型支持
- [ ] 图片处理和优化
- [ ] 高级内容分析
- [ ] 更多预设模板
- [ ] 实时预览功能

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 许可证

本项目采用 MIT 许可证 - 详情请见 [LICENSE](LICENSE) 文件。

## 致谢

- [Slidev](https://github.com/slidevjs/slidev) - 现代化的演讲幻灯片框架
- [LittleSound/talks-template](https://github.com/LittleSound/talks-template) - 演讲模板灵感来源
- [Model Context Protocol](https://modelcontextprotocol.io/) - AI代理通信协议
