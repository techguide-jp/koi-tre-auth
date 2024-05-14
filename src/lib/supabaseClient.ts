import { RealtimeChannel, createClient } from '@supabase/supabase-js'
import { lastLlmText, usage } from './stores'

// 環境変数からSupabaseのURLとキーを取得
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
// 利用枠の回数
const limit = 10

const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * 今月の利用回数を取得する
 *
 * @param userFirebaseId
 * @returns
 */
async function checkUsage(userFirebaseId: string): Promise<number | null> {
  console.log('Checking usage for user:', userFirebaseId)
  const startOfMonth = new Date()
  startOfMonth.setDate(1) // 今月の初め
  startOfMonth.setHours(0, 0, 0, 0) // 時間を00:00:00に設定

  if (!userFirebaseId) {
    return null
  }

  // Supabaseからデータを取得
  const { data, error } = await supabase
    .from('operations')
    .select('*')
    .eq('uid', userFirebaseId)
    .gte('created_at', startOfMonth.toISOString())
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching data:', error)
    throw new Error('Error fetching data')
  }

  return limit - data.length
}

function subscribeToUsageUpdates(userFirebaseId: string): RealtimeChannel {
  console.log('Subscribing to usage updates')
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  // Supabase Realtime Channel 購読
  const channel = supabase
    .channel('operations-changes:' + userFirebaseId)
    .on(
      'postgres_changes',
      {
        event: '*', // "INSERT", "UPDATE", "DELETE"
        schema: 'public',
        table: 'operations',
        filter: `uid=eq.${userFirebaseId}` // TODO: 日をまたいだ場合の考慮
      },
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          console.log('Usage updated:', payload.new)
          usage.update((n) => n - 1)
          lastLlmText.set(payload.new.llm_text)
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('Channel subscribed')
      }

      if (status === 'CHANNEL_ERROR') {
        console.error('Channel error:', err)
      }

      if (status === 'TIMED_OUT') {
        console.error('Channel timed out')
      }
    })
  return channel
}

/**
 * 最後に受信したLLM回答を取得する
 *
 * @returns
 */
async function getLastLlmText(userFirebaseId: string) {
  // Supabaseからデータを取得
  const { data, error } = await supabase
    .from('operations')
    .select('llm_text')
    .eq('uid', userFirebaseId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching data:', error)
    throw new Error('Error fetching data')
  }

  return data[0].llm_text
}

export { supabase, checkUsage, subscribeToUsageUpdates, getLastLlmText } // Allowing checkUsage to be imported externally
