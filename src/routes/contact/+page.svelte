<svelte:head>
	<title>お問い合わせ</title>
	<meta name="description" content="Koi-Treのお問い合わせページです" />
</svelte:head>

<div class="bg-gray-100">
    <div class="container mx-auto py-12">
        <div class="max-w-lg mx-auto px-4">
            <h2 class="text-3xl font-semibold text-gray-900 mb-4">
                お問い合わせ
            </h2>
            <p class="text-gray-700 mb-8">
                Koi-Treをご利用いただきありがとうございます。<br>何かご質問やご要望がございましたら、お気軽にお知らせください。
            </p>
						<form action="https://submit-form.com/Sn4hRi2Aw" class="bg-white rounded-lg px-6 py-8 shadow-md">
								<div class="mb-4">
										<label class="block text-gray-700 font-bold mb-2" for="name">名前</label>
										<input
												class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-transform duration-500"
												id="name" type="text" placeholder="お名前を入力してください"
												required>
								</div>
								<div class="mb-4">
										<label class="block text-gray-700 font-bold mb-2" for="email">メールアドレス</label>
										<input
												class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-transform duration-500"
												id="email" type="email" placeholder="メールアドレスを入力してください"
												required>
								</div>
								<div class="mb-4">
										<label class="block text-gray-700 font-bold mb-2" for="questionType">質問の種類</label>
										<select
												class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-transform duration-500"
												id="questionType"
												required>
												<option value="">選択してください</option>
												<option value="general">Koi-Treに関する質問</option>
												<option value="feedback">フィードバック</option>
												<option value="inquiry">お問い合わせ</option>
												<option value="consultation">ご相談</option>
												<option value="other">その他</option>
										</select>
								</div>
								<div class="mb-4">
										<label class="block text-gray-700 font-bold mb-2" for="message">メッセージ</label>
										<textarea
												class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-transform duration-500"
												id="message" rows="6" placeholder="メッセージを入力してください" required></textarea>
								</div>
								<div class="flex justify-end">
										<button
												class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
												type="submit">
												送信
										</button>
								</div>
						</form>
        </div>
    </div>
</div>
