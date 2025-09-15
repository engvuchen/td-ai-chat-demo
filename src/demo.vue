<template>
    <div class="container">
        <t-chat
            ref="chatRef"
            layout="single"
            style="max-height: 100%"
            :clear-history="chatList.length > 0 && !isStreamLoad"
            @clear="clearConfirm"
        >
            <template v-for="(item, index) in chatList" :key="index">
                <t-chat-item
                    :avatar="item.avatar"
                    :name="item.name"
                    :role="item.role"
                    :datetime="item.datetime"
                    :content="item.content"
                    :text-loading="index === 0 && loading"
                >
                    <template v-if="!isStreamLoad" #actions>
                        <t-chat-action
                            :is-good="isGood"
                            :is-bad="isBad"
                            :content="item.content"
                            @operation="
                                (type, { e }) =>
                                    handleOperation(type, { e, index })
                            "
                        />
                    </template>
                </t-chat-item>
            </template>
            <template #footer>
                <t-chat-input
                    :stop-disabled="isStreamLoad"
                    @send="inputEnter"
                    @stop="onStop"
                >
                </t-chat-input>
            </template>
        </t-chat>
    </div>
</template>
<script setup>
import { ref } from 'vue';
import { fetchEventSource } from '@microsoft/fetch-event-source';

const fetchCancel = ref(null);
const loading = ref(false);
const isStreamLoad = ref(false);
const isGood = ref(false);
const isBad = ref(false);
const chatRef = ref(null);

// 滚动到底部
const backBottom = () => {
    chatRef.value.scrollToBottom({
        behavior: 'smooth',
    });
};
// 倒序渲染
const chatList = ref([
    {
        avatar: 'https://tdesign.gtimg.com/site/chat-avatar.png',
        name: 'TD&AI',
        datetime: `今天${new Date()}`, // todo
        content: '早上好，我是你的助理小Ai，请问今天有什么安排？',
        role: 'assistant',
    },
]);
const clearConfirm = function () {
    chatList.value = [];
};
const onStop = function () {
    if (fetchCancel.value) {
        fetchCancel.value.abort();
        loading.value = false;
        isStreamLoad.value = false;
    }
};
const handleOperation = function (type, options) {
    const { index } = options;
    if (type === 'good') {
        isGood.value = !isGood.value;
        isBad.value = false;
    } else if (type === 'bad') {
        isBad.value = !isBad.value;
        isGood.value = false;
    } else if (type === 'replay') {
        const userQuery = chatList.value[index + 1].content;
        inputEnter(userQuery);
    }
};
const handleData = async (inputValue) => {
    loading.value = true;
    isStreamLoad.value = true;
    const lastItem = chatList.value[0];
    const messages = [
        {
            role: 'user',
            content: inputValue,
        },
    ];
    fetchSSE(messages, {
        success(result) {
            loading.value = false;
            const { data } = result;
            lastItem.content += data?.delta?.content;
        },
        complete(isOk, msg) {
            if (!isOk || !lastItem.content) {
                lastItem.role = 'error';
                lastItem.content = msg;
            }
            // 控制终止按钮
            isStreamLoad.value = false;
            loading.value = false;
        },
        cancel(cancel) {
            fetchCancel.value = cancel;
        },
    });
};
const inputEnter = function (inputValue) {
    if (isStreamLoad.value) {
        return;
    }
    if (!inputValue) return;
    const params = {
        avatar: 'https://tdesign.gtimg.com/site/avatar.jpg',
        name: '自己',
        datetime: new Date().toDateString(),
        content: inputValue,
        role: 'user',
    };
    chatList.value.unshift(params);
    // 空消息占位
    const params2 = {
        avatar: 'https://tdesign.gtimg.com/site/chat-avatar.png',
        name: 'TD&AI',
        datetime: new Date().toDateString(),
        content: '',
        role: 'assistant',
    };
    chatList.value.unshift(params2);
    handleData(inputValue);
};
// 使用 @microsoft/fetch-event-source 解析SSE数据
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
</script>
<style>
html,
body {
    margin: 0;
    padding: 0;
}
</style>
<style lang="less" scoped>
.container {
    width: calc(100% - 80px);
    height: calc(100% - 80px);
    box-sizing: border-box;
    margin: 40px;
    padding: 40px;
    border: 1px solid #eee;
    border-radius: 10px;
}
</style>
