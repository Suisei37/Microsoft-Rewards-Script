import PQueue from 'p-queue'
import TelegramBot from 'node-telegram-bot-api'

let bot: TelegramBot | null = null
let chatId: string = ''

const telegramQueue = new PQueue({
    interval: 1000,
    intervalCap: 1
})

export function initTelegram(token: string, targetChatId: string) {
    bot = new TelegramBot(token, { polling: false })
    chatId = targetChatId
}

export async function sendTelegram(text: string) {
    if (!bot || !chatId) return

    await telegramQueue.add(async () => {
        await bot!.sendMessage(chatId, text)
    })
}

export async function flushTelegramQueue(timeoutMs = 5000): Promise<void> {
    await Promise.race([
        telegramQueue.onIdle(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('telegram flush timeout')), timeoutMs)
        )
    ]).catch(() => {})
}

export function formatSummaryStats(accountStats: any[]) {
    let msg = `📊 ACCOUNT STATS\n\n`

    for (const acc of accountStats) {
        let status =
            !acc.success ? '❌ ERROR' :
            acc.collectedPoints > 0 ? `✅ +${acc.collectedPoints} pts` :
            '⚠️ 0 pts'

        msg += `• ${acc.email}\n`
        msg += `  ${acc.initialPoints} → ${acc.finalPoints}\n`
        msg += `  ${status}\n`

        // DAILY
        if (acc.dailyCheckIn) {
            msg += `  🗓 Daily: ${
                acc.dailyCheckIn.success
                    ? `✅ +${acc.dailyCheckIn.points}`
                    : '❌ gagal'
            }\n`
        }

        // READ
        if (acc.readToEarn) {
            msg += `  📖 Read: ${
                acc.readToEarn.success
                    ? `✅ +${acc.readToEarn.points} (${acc.readToEarn.articlesRead}/10)`
                    : '❌ gagal'
            }\n`
        }

        msg += `\n`
    }

    return msg
}
