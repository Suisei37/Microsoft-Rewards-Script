import makeWASocket, {
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    fetchLatestWaWebVersion,
    DisconnectReason
} from '@whiskeysockets/baileys'

import pino from 'pino'
import { Boom } from '@hapi/boom'

import fs from 'fs'

const originalLog = console.log

console.log = (...args: any[]) => {
    const msg = args[0]

    if (
        typeof msg === 'string' &&
        msg.includes('Closing session: SessionEntry')
    ) {
        return // 🔥 block log ini
    }

    originalLog(...args)
}

let sock: any = null
let isReady = false
let isConnecting = false

// ==============================
// INIT WA (DIPANGGIL SEKALI)
// ==============================
export async function initWhatsApp(sessionPath: string, phoneNumber: string) {
    if (isConnecting) return
    isConnecting = true

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const logger = pino({ level: 'silent' })
    const { version } = await fetchLatestWaWebVersion()

    sock = makeWASocket({
        version,
        logger,
        browser: ['Android', 'Chrome', '120.0.0'],

        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },

        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 30000,
    })

    sock.ev.on('creds.update', saveCreds)

    let pairingRequested = false

    sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect } = update

        if (connection === 'connecting') {
            console.log('🔄 Connecting to WhatsApp...')
        }

        // ==============================
        // PAIRING (SEKALI SAJA)
        // ==============================
        if (!pairingRequested && !sock.authState.creds.registered) {
            pairingRequested = true

            console.log('\n📱 BUKA WhatsApp di HP:')
            console.log('Settings > Linked Devices > Link Device > Pairing Code\n')

            try {
                await delay(3000)

                console.log('📡 Requesting pairing code...')
                const code = await sock.requestPairingCode(phoneNumber)

                console.log(`🔑 Pairing Code: ${code}`)
                console.log('⏳ Expire ~90 detik\n')

            } catch (err) {
                console.log('❌ Pairing gagal:', err)
                pairingRequested = false
            }
        }

        // ==============================
        // CONNECTED
        // ==============================
        if (connection === 'open') {
            console.log('✅ WhatsApp Connected')
            isReady = true
            isConnecting = false
        }

        // ==============================
        // DISCONNECT HANDLER (ANTI LOOP)
        // ==============================
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            
            // 🔥 HANDLE KHUSUS 515
    if (reason === 515) {
        console.log('🔄 Logging in (pairing in progress)...')
        return
    } 

            console.log('❌ Disconnected, reason:', reason)

            isReady = false
            isConnecting = false

            if (reason === DisconnectReason.loggedOut) {
                console.log('❌ Session logout! Hapus session folder.')
                return
            }

            console.log('🔄 Reconnecting in 5s...')
            setTimeout(() => {
                initWhatsApp(sessionPath, phoneNumber)
            }, 5000)
        }
    })
}
// ==============================
// FUNGSI HAPUS FOLDER SESSION
// ==============================
function clearSession(sessionPath: string) {
    try {
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true })
            console.log('🧹 Session WhatsApp dihapus (invalid)')
        }
    } catch (err) {
        console.error('❌ Gagal hapus session:', err)
    }
}

// ==============================
// BLOCK SAMPAI WA READY
// ==============================
export async function ensureWhatsAppReady(
    sessionPath: string,
    phoneNumber: string,
    timeoutMs = 90000 // 
): Promise<boolean> {
    await initWhatsApp(sessionPath, phoneNumber)

    console.log('⏳ Menunggu WhatsApp ready (max 90 detik)...')

    const start = Date.now()

    while (!isReady) {
        await delay(1000) // cek tiap 1 detik (tanpa spam log)

        if (Date.now() - start > timeoutMs) {
            console.log('⚠️ WhatsApp tidak ready dalam 90 detik, lanjut tanpa WA...')
             clearSession(sessionPath)
            return false
        }
    }

    console.log('✅ WhatsApp siap digunakan')
    return true
}

// ==============================
// SEND MESSAGE
// ==============================
export async function sendWhatsApp(number: string, text: string) {
    if (!sock || !isReady) {
        console.log('❌ WhatsApp belum siap')
        return
    }

    try {
        await sock.sendMessage(number + '@s.whatsapp.net', { text })
    } catch (err) {
        console.error('WA send error:', err)
    }
}

export function formatWhatsAppStats(accountStats: any[]) {
    let msg = `📊 *ACCOUNT STATS*\n\n`

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

// ==============================
// UTIL
// ==============================
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
