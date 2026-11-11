<script lang="ts">
  import { fade } from 'svelte/transition'
  import { CONTACT_LIMITS, CONTACT_TOPICS, SUPPORT_EMAIL } from '$lib/contact'
  const billingEmailLink = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[Koi-Tre] 購入・請求・解約のお問い合わせ')}`

  let name = ''
  let email = ''
  let questionType = ''
  let message = ''
  let website = ''
  let submitting = false
  let submitted = false
  let submitError = ''
  let previousAttempt: { body: string; id: string } | null = null

  async function onSubmit() {
    if (submitting) return
    submitError = ''
    try {
      submitting = true
      const payload = { name, email, questionType, message, website }
      const body = JSON.stringify(payload)
      if (previousAttempt?.body !== body) previousAttempt = { body, id: crypto.randomUUID() }
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ ...payload, requestId: previousAttempt.id })
      })
      if (!response.ok) {
        const failure = await response.json().catch(() => null)
        submitError = failure?.message ?? '送信できませんでした。時間をおいて再度お試しください。'
        return
      }
      submitted = true
      message = ''
    } catch {
      submitError = '送信できませんでした。入力内容は残っています。時間をおいて再度お試しください。'
    } finally {
      submitting = false
    }
  }
</script>

<div class="bg-gray-100">
  <div class="container mx-auto py-12">
    <div class="max-w-lg mx-auto px-4">
      <h2 class="text-3xl font-semibold text-gray-900 mb-4 text-center">お問い合わせ</h2>
      <p class="text-gray-700 mb-8">
        Koi-Treをご利用いただきありがとうございます。<br
        />何かご質問やご要望がございましたら、お気軽にお知らせください。
      </p>
      <section class="mb-6 rounded-lg border bg-white px-6 py-5" aria-labelledby="billing-contact">
        <h3 id="billing-contact" class="font-semibold">購入・請求・解約のお問い合わせ</h3>
        <p class="mt-2">
          <a class="underline" href="{billingEmailLink}">{SUPPORT_EMAIL}</a>
          へ直接メールでもご連絡いただけます。
        </p>
      </section>
      {#if !submitted}
        <form
          on:submit|preventDefault="{onSubmit}"
          class="bg-white rounded-lg px-6 py-8 shadow-md"
          in:fade="{{ duration: 300 }}"
        >
          <fieldset disabled="{submitting}">
            <input
              class="hidden"
              type="text"
              name="website"
              bind:value="{website}"
              autocomplete="off"
              tabindex="-1"
              aria-hidden="true"
            />
            <div class="mb-4">
              <label class="block text-gray-700 font-bold mb-2" for="name">名前</label>
              <input
                bind:value="{name}"
                class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-transform duration-500"
                id="name"
                type="text"
                placeholder="お名前を入力してください"
                maxlength="{CONTACT_LIMITS.name}"
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
                maxlength="{CONTACT_LIMITS.email}"
                required
              />
            </div>
            <div class="mb-4">
              <label class="block text-gray-700 font-bold mb-2" for="questionType">質問の種類</label
              >
              <select
                bind:value="{questionType}"
                class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-transform duration-500"
                id="questionType"
                required
              >
                <option value="">選択してください</option>
                {#each Object.entries(CONTACT_TOPICS) as [value, label]}
                  <option value="{value}">{label}</option>
                {/each}
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
                maxlength="{CONTACT_LIMITS.message}"
                required
              ></textarea>
            </div>
            {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}
            <div class="flex justify-end">
              <button
                aria-busy="{submitting}"
                class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                type="submit"
              >
                {submitting ? '送信中…' : '送信'}
              </button>
            </div>
          </fieldset>
        </form>
      {/if}
      {#if submitted}
        <div class="mt-8 text-center" in:fade="{{ duration: 300 }}" role="status">
          <p class="text-green-700">お問い合わせありがとうございます！</p>
          <p class="text-green-700">ご返信まで少々お待ちください。</p>
        </div>
      {/if}
    </div>
  </div>
</div>
