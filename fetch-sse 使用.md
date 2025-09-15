# Fetch SSE 使用文档

## 概述

本文档记录了在 TDesign AI 聊天演示项目中使用 `@microsoft/fetch-event-source` 包实现 Server-Sent Events (SSE) 流式数据处理的实现方式。

## 技术栈变更

- **之前**：使用原生 `fetch` API + 手动处理流式数据
- **现在**：使用 `@microsoft/fetch-event-source` 包，基于 `fetch` API 的封装

## 核心实现

### 1. 安装依赖

```bash
npm install @microsoft/fetch-event-source
```

### 2. 导入包

```javascript
import { fetchEventSource } from '@microsoft/fetch-event-source';
```

### 3. 主要函数：`fetchSSE`

```javascript
const fetchSSE = async (messages, options) => {
    const { success, fail, complete, cancel } = options;
    const controller = new AbortController();
    cancel?.(controller);
    
    // API 配置
    const apiKey = 'sk-6R0hq8U7v3bSbT1u41Lp6kPRwAgf9wnW73WgvSC7WUI73eRO';
    
    try {
        await fetchEventSource('/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer${apiKey ? ` ${apiKey}` : ''}`,
            },
            body: JSON.stringify({
                messages, // 消息列表
                model: 'hunyuan-pro', // 模型
                stream: true, // 流式
            }),
            signal: controller.signal,
            
            // 连接打开时的处理
            onopen(response) {
                if (response.ok) {
                    return; // 一切正常
                } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    // 客户端错误，不应该重试
                    throw new Error(`客户端错误: ${response.status} ${response.statusText}`);
                } else {
                    // 其他错误，可以重试
                    throw new Error(`服务器错误: ${response.status} ${response.statusText}`);
                }
            },
            
            // 接收到消息时的处理
            onmessage(event) {
                try {
                    // 检查是否是结束标志
                    if (event.data === '[DONE]') {
                        complete?.(true);
                        return;
                    }
                    
                    // 解析数据
                    const data = JSON.parse(event.data);
                    const choices = data?.choices?.[0];
                    
                    if (choices?.finish_reason === 'stop') {
                        complete?.(true);
                    } else if (choices?.delta) {
                        // 发送增量数据
                        success({ 
                            type: 'delta', 
                            data: choices 
                        });
                    }
                } catch (e) {
                    console.error('解析SSE数据失败:', e);
                    // 不抛出错误，继续处理下一条消息
                }
            },
            
            // 错误处理
            onerror(err) {
                console.error('SSE连接错误:', err);
                complete?.(false, err.message || '连接异常');
                fail?.();
                // 返回 undefined 表示不重试
                return;
            },
            
            // 连接关闭时的处理
            onclose() {
                complete?.(true);
            }
        });
    } catch (error) {
        console.error('fetchEventSource 异常:', error);
        complete?.(false, error.message || '流式接口异常');
        fail?.();
    }
};
```

## 关键特性

### 1. 事件驱动的处理方式

`@microsoft/fetch-event-source` 提供了四个主要的事件回调：

- **`onopen`**: 连接建立时的处理
- **`onmessage`**: 接收到数据时的处理  
- **`onerror`**: 发生错误时的处理
- **`onclose`**: 连接关闭时的处理

### 2. 自动重试机制

库内置了智能重试机制：
- 网络错误自动重试
- 服务器错误（5xx）自动重试
- 客户端错误（4xx）不重试
- 可配置重试间隔和次数

### 3. 请求取消支持

```javascript
const controller = new AbortController();
signal: controller.signal, // 支持取消请求

// 在组件中取消
const onStop = function () {
    if (fetchCancel.value) {
        fetchCancel.value.abort();
        loading.value = false;
        isStreamLoad.value = false;
    }
};
```

### 4. 错误分类处理

```javascript
onopen(response) {
    if (response.ok) {
        return; // 一切正常
    } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        // 客户端错误，不应该重试
        throw new Error(`客户端错误: ${response.status} ${response.statusText}`);
    } else {
        // 其他错误，可以重试
        throw new Error(`服务器错误: ${response.status} ${response.statusText}`);
    }
}
```

### 5. 数据解析优化

```javascript
onmessage(event) {
    try {
        // 检查是否是结束标志
        if (event.data === '[DONE]') {
            complete?.(true);
            return;
        }
        
        // 解析数据
        const data = JSON.parse(event.data);
        const choices = data?.choices?.[0];
        
        if (choices?.finish_reason === 'stop') {
            complete?.(true);
        } else if (choices?.delta) {
            // 发送增量数据
            success({ 
                type: 'delta', 
                data: choices 
            });
        }
    } catch (e) {
        console.error('解析SSE数据失败:', e);
        // 不抛出错误，继续处理下一条消息
    }
}
```

## 使用方式

### 1. 在组件中调用
```javascript
const handleData = async (inputValue) => {
    loading.value = true;
    isStreamLoad.value = true;
    const lastItem = chatList.value[0];
    
    fetchSSE(messages, {
        success(result) {
            loading.value = false;
            const { data } = result;
            lastItem.content += data?.delta?.content; // 累积内容
        },
        complete(isOk, msg) {
            if (!isOk || !lastItem.content) {
                lastItem.role = 'error';
                lastItem.content = msg;
            }
            isStreamLoad.value = false;
            loading.value = false;
        },
        cancel(cancel) {
            fetchCancel.value = cancel; // 保存取消函数
        },
    });
};
```

### 2. 回调函数说明
- **success**: 接收到数据块时调用
- **complete**: 流式传输完成时调用
- **fail**: 发生错误时调用
- **cancel**: 提供取消请求的 controller

## 技术细节

### 1. 流式数据格式
- 使用 `response.body.getReader()` 读取流
- 通过 `TextDecoder` 解码二进制数据
- 按 `\r?\n` 分割数据行
- 解析 JSON 格式的 SSE 数据

### 2. 数据格式示例
```javascript
// 接收到的数据格式
{
    type: 'delta',
    data: {
        delta: {
            content: 'Hello' // 增量内容
        },
        finish_reason: null
    }
}

// 结束标志
{
    type: 'finish',
    data: null
}
```

### 3. 内存管理
- 使用 `bufferArr` 缓冲不完整的数据
- 及时清理已处理的数据行
- 避免内存泄漏

## 优缺点分析

### 优点
1. **代码简洁**：从 80+ 行减少到 50+ 行，逻辑更清晰
2. **自动重试**：内置智能重试机制，提升稳定性
3. **错误分类**：自动区分客户端错误和服务器错误
4. **事件驱动**：更符合 SSE 的使用模式
5. **成熟稳定**：经过充分测试的库，处理各种边界情况
6. **页面可见性**：自动在页面不可见时暂停连接
7. **完全兼容**：底层仍使用 fetch API，无性能损失

### 缺点
1. **额外依赖**：增加约 2-3KB 的包体积
2. **学习成本**：需要了解库的 API 和配置选项
3. **定制限制**：某些高级定制可能需要回退到原生实现

## 迁移对比

### 代码行数对比
- **原生 fetch**：~80 行复杂逻辑
- **fetch-event-source**：~50 行简洁代码

### 功能对比
| 功能 | 原生 fetch | fetch-event-source |
|------|------------|-------------------|
| 基础 SSE 处理 | ✅ 手动实现 | ✅ 自动处理 |
| 错误重试 | ❌ 需手动实现 | ✅ 自动重试 |
| 请求取消 | ✅ 支持 | ✅ 支持 |
| 错误分类 | ❌ 需手动实现 | ✅ 自动分类 |
| 页面可见性 | ❌ 需手动实现 | ✅ 自动处理 |
| 代码维护性 | ❌ 复杂 | ✅ 简洁 |

## 总结

使用 `@microsoft/fetch-event-source` 包后，SSE 流式数据处理变得更加：
- **简洁**：代码量减少 40%
- **稳定**：内置重试和错误处理
- **易维护**：事件驱动的清晰结构
- **功能完整**：支持所有现代 SSE 需求

这是一个值得推荐的升级方案，特别适合生产环境使用。
