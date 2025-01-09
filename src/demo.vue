<template>
  <t-chat
    ref="chatRef"
    layout="single"
    style="height: 100vh;"
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
            @operation="(type, { e }) => handleOperation(type, { e, index })"
          />
        </template>
      </t-chat-item>
    </template>
    <template #footer>
      <t-chat-input :stop-disabled="isStreamLoad" @send="inputEnter" @stop="onStop"> </t-chat-input>
    </template>
  </t-chat>
</template>
<script setup>
import { ref } from 'vue';

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
    datetime: '今天09:38',
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
  const messages = [{
    role: 'user',
    content: inputValue,
  }];
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
// 解析SSE数据
const fetchSSE = async (messages, options) => {
  const { success, fail, complete, cancel } = options;
  const controller = new AbortController();
  const { signal } = controller;
  cancel?.(controller);
  // your-api-key
  const apiKey = 'sk-6R0hq8U7v3bSbT1u41Lp6kPRwAgf9wnW73WgvSC7WUI73eRO';
  const responsePromise = fetch('/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer${apiKey ? ` ${apiKey}` : ''}`,
    },
    body: JSON.stringify({
      messages, // 消息列表
      model: 'hunyuan-pro', // 模型
      stream: true, // 流式
    }),
    signal,
  }).catch((e) => {
    const msg = e.toString() || '流式接口异常';
    complete?.(false, msg);
    return Promise.reject(e); // 确保错误能够被后续的.catch()捕获
  });

  responsePromise
    .then((response) => {
      if (!response?.ok) {
        complete?.(false, response.statusText);
        fail?.();
        throw new Error('Request failed'); // 抛出错误以便链式调用中的下一个.catch()处理
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader available');

      const bufferArr = [];
      let dataText = ''; // 记录数据
      const event = { type: null, data: null };

      async function processText({ done, value }) {
        if (done) {
          complete?.(true);
          return Promise.resolve();
        }
        const chunk = decoder.decode(value);
        const buffers = chunk.toString().split(/\r?\n/);
        bufferArr.push(...buffers);
        const i = 0;
        while (i < bufferArr.length) {
          const line = bufferArr[i];
          if (line) {
            dataText += line;
            const response = line.slice(6);
            if (response === '[DONE]') {
              event.type = 'finish';
              dataText = '';
            } else {
              const choices = JSON.parse(response.trim())?.choices?.[0];
              if (choices.finish_reason === 'stop') {
                event.type = 'finish';
                dataText = '';
              } else {
                event.type = 'delta';
                event.data = choices;
              }
            }
          }
          if (event.type && event.data) {
            const jsonData = JSON.parse(JSON.stringify(event));
            // debugger;
            success(jsonData);
            event.type = null;
            event.data = null;
          }
          bufferArr.splice(i, 1);
        }
        return reader.read().then(processText);
      }

      return reader.read().then(processText);
    })
    .catch(() => {
      // 处理整个链式调用过程中发生的任何错误
      fail?.();
    });
};

</script>
<style lang="less" scoped></style>

