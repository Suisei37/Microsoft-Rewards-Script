import { chromium, Browser as PWBrowser, BrowserContext } from 'playwright-core'

import { newInjectedContext } from 'fingerprint-injector'
import { BrowserFingerprintWithHeaders, FingerprintGenerator } from 'fingerprint-generator'

import type { MicrosoftRewardsBot } from '../index'
import { loadSessionData, saveFingerprintData } from '../util/Load'
import { UserAgentManager } from './UserAgent'

import type { AccountProxy } from '../interface/Account'

class Browser {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    async createBrowser(
        proxy: AccountProxy,
        email: string
    ): Promise<{
        context: BrowserContext
        fingerprint: BrowserFingerprintWithHeaders
    }> {
        let browser: PWBrowser

        try {
            browser = await chromium.launch({
                headless: this.bot.config.headless,
                executablePath: '/usr/bin/chromium',
                proxy: proxy.url
                    ? {
                          server: `${proxy.url}:${proxy.port}`,
                          username: proxy.username,
                          password: proxy.password
                      }
                    : undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--mute-audio',
                    '--ignore-certificate-errors',
                    '--ignore-ssl-errors',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-features=WebAuthentication,PasswordManagerOnboarding,PasswordManager,Passkeys',
                    '--disable-blink-features=AutomationControlled'
                ]
            })
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'BROWSER',
                `Launch failed: ${error instanceof Error ? error.message : String(error)}`
            )
            throw error
        }

        const sessionData = await loadSessionData(
            this.bot.config.sessionPath,
            email,
            this.bot.config.saveFingerprint,
            this.bot.isMobile
        )

        const fingerprint = sessionData.fingerprint
            ? sessionData.fingerprint
            : await this.generateFingerprint(this.bot.isMobile)

        const context = await newInjectedContext(browser as any, {
            fingerprint
        })

        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'credentials', {
                value: {
                    create: () => Promise.reject(new Error('WebAuthn disabled')),
                    get: () => Promise.reject(new Error('WebAuthn disabled'))
                }
            })
        })

        context.setDefaultTimeout(
            this.bot.utils.stringToNumber(this.bot.config?.globalTimeout ?? 30000)
        )

        if (sessionData.cookies?.length) {
            await context.addCookies(sessionData.cookies)
        }

        if (this.bot.config.saveFingerprint) {
            await saveFingerprintData(
                this.bot.config.sessionPath,
                email,
                this.bot.isMobile,
                fingerprint
            )
        }

        this.bot.logger.info(
            this.bot.isMobile,
            'BROWSER',
            `Created browser with UA: "${fingerprint.fingerprint.navigator.userAgent}"`
        )

        this.bot.logger.debug(
            this.bot.isMobile,
            'BROWSER-FINGERPRINT',
            JSON.stringify(fingerprint)
        )

        return {
            context: context as unknown as BrowserContext,
            fingerprint
        }
    }

    async generateFingerprint(isMobile: boolean) {
        const generator = new FingerprintGenerator()

        const fingerprintData = generator.getFingerprint({
            devices: isMobile ? ['mobile'] : ['desktop'],
            operatingSystems: isMobile ? ['android'] : ['linux', 'windows'],
            browsers: [{ name: 'edge' }]
        })

        const userAgentManager = new UserAgentManager(this.bot)
        return userAgentManager.updateFingerprintUserAgent(
            fingerprintData,
            isMobile
        )
    }
}

export default Browser
