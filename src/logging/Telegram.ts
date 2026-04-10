import TelegramBot from 'node-telegram-bot-api'

let bot: TelegramBot | null = null
let chatId: string = ''

export function initTelegram(token: string, targetChatId: string) {
    bot = new TelegramBot(token, { polling: false })
    chatId = targetChatId
}

export async function sendTelegram(text: string) {
    if (!bot || !chatId) return

    try {
        await bot.sendMessage(chatId, text)
    } catch (err) {
        console.error('Telegram send error:', err)
    }
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
        msg += `  ${status}\n\n`
    }

    return msg
}
