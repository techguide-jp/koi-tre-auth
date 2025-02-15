<script lang="ts">
  import { fade } from 'svelte/transition'
  const FORMSPARK_ACTION_URL = 'https://submit-form.com/Sn4hRi2Aw'

  let name = ''
  let email = ''
  let questionType = ''
  let message = ''
  let submitting = false
  let submitted = false

  async function onSubmit() {
    try {
      submitting = true
      await fetch(FORMSPARK_ACTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          questionType,
          message
        })
      })
      message = ''
    } finally {
      submitting = false
      submitted = true
    }
  }
</script>

<svelte:head>
  <title>{import.meta.env.VITE_APP_TITLE} - CONTACT</title>
  <meta
    name="description"
    content="Koi-Treのお問い合わせページです。何かご質問やご要望がございましたら、お気軽にお知らせください。"
  />
</svelte:head>

<div class="bg-gray-100">
  <div class="container mx-auto py-12">
    <div class="max-w-lg mx-auto px-4">
      <h2 class="text-3xl font-semibold text-gray-900 mb-4 text-center">お問い合わせ</h2>
      <p class="text-gray-700 mb-8">
        Koi-Treをご利用いただきありがとうございます。<br
        />何かご質問やご要望がございましたら、お気軽にお知らせください。
      </p>
      {#if submitting}
        <div class="flex justify-center items-center">
          <div class="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      {:else if !submitting && !submitted}
        <form
          on:submit|preventDefault="{onSubmit}"
          class="bg-white rounded-lg px-6 py-8 shadow-md"
          in:fade="{{ duration: 300 }}"
        >
          <div class="mb-4">
            <label class="block text-gray-700 font-bold mb-2" for="name">名前</label>
            <input
              bind:value="{name}"
              class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-transform duration-500"
              id="name"
              type="text"
              placeholder="お名前を入力してください"
              required
            />
          </div>
          <div class="mb-4">
            <label class="block text-gray-700 font-bold mb-2" for="email">メールアドレス</label>
            <input
              bind:value="{email}"
              class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-transform duration-500"
              id="email"
              type="email"
              placeholder="メールアドレスを入力してください"
              required
            />
          </div>
          <div class="mb-4">
            <label class="block text-gray-700 font-bold mb-2" for="questionType">質問の種類</label>
            <select
              bind:value="{questionType}"
              class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-transform duration-500"
              id="questionType"
              required
            >
              <option value="">選択してください</option>
              <option value="general">Koi-Treに関する質問</option>
              <option value="feedback">フィードバック</option>
              <option value="consultation">ご相談</option>
              <option value="other">その他</option>
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-gray-700 font-bold mb-2" for="message">メッセージ</label>
            <textarea
              bind:value="{message}"
              class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-transform duration-500"
              id="message"
              rows="6"
              placeholder="メッセージを入力してください"
              required
            ></textarea>
          </div>
          <div class="flex justify-end">
            <button
              disabled="{submitting}"
              class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="submit"
            >
              送信
            </button>
          </div>
        </form>
      {/if}
      {#if submitted}
        <div class="mt-8 text-center" in:fade="{{ duration: 300 }}">
          <p class="text-green-700">お問い合わせありがとうございます！</p>
          <p class="text-green-700">ご返信まで少々お待ちください。</p>
        </div>
      {/if}
    </div>
  </div>
</div>
