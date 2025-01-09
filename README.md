
# 使用腾讯云AI代码助手快速实现一个办公AI助手

这是一个基于 Vue.js 和 TDesign 的 AI 聊天演示项目。

## 版本信息

- Node.js 版本: v18+

## 安装依赖

在项目根目录下运行以下命令来安装所有依赖：


## 运行项目

安装完依赖后，可以通过以下命令启动开发服务器：


bash
## 版本nodejs v18+

```bash
# Install
npm i
npm run dev
```


服务器启动后，默认会在 `http://localhost:3000` 上运行。

## 目录结构


```

├── .git/ # Git 版本控制相关的文件

├── node_modules/ # 通过 npm 安装的依赖包

├── public/ # 静态资源文件

├── src/ # 源代码

│ ├── assets/ # 资源文件，如图片、字体等

│ ├── components/ # Vue 组件

│ ├── views/ # 页面级组件

│ ├── App.vue # 主组件

│ ├── main.js # 入口文件

│ └── ... # 其他源文件

├── .gitignore # Git 忽略文件配置

├── package.json # 项目配置文件

├── README.md # 项目说明文件

└── ... # 其他配置文件
```


## 功能特性

- 实时聊天交互
- AI 模型切换提示
- 用户反馈机制（好评、差评、重播）
- 流式加载支持

## 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork 项目到你的 GitHub 账户。
2. 创建一个新的分支 (`git checkout -b feature/your-feature-name`)
3. 提交你的更改 (`git commit -am 'Add some feature'`)
4. 推送你的分支到 GitHub (`git push origin feature/your-feature-name`)
5. 创建一个 Pull Request

## 许可证

本项目采用 MIT 许可证，详情请参见 [LICENSE](LICENSE) 文件。

## 源码

https://github.com/zacksleo/td-ai-chat-demo

## 视频

https://live.csdn.net/v/442764

## 参考资料

- [Vue.js 官方文档](https://vuejs.org/v2/guide/)
- [TDesign 官方文档](https://tdesign.tencent.com/vue/)