import type { Page } from 'playwright-core'
import type { MicrosoftRewardsBot } from '../../../index'

export class MonthlyClaim {
    private bot: MicrosoftRewardsBot
    private maxRetries = 3
    
    private gainedPoints: number = 0
    private oldBalance: number = 0

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }
    public async doMonthlyClaim(page: Page) {
        this.bot.logger.info(this.bot.isMobile, 'MONTHLY-CLAIM', 'Checking monthly claim availability')

        await this.bot.browser.utils.tryDismissAllMessages(page)

        this.oldBalance = Number(this.bot.userData.currentPoints ?? 0)

        try {
           // STEP 1: langsung klik card (tanpa baca points)
            const card = page.locator('text=Ready to claim').first()

            if (!(await card.count())) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'MONTHLY-CLAIM',
                    'Claim card not found'
               )
                     return
           }

            this.bot.logger.info(
                this.bot.isMobile,
                'MONTHLY-CLAIM',
                `Opening claim card | oldBalance=${this.oldBalance}`
            )

            await card.click()

            await this.bot.utils.wait(2500)

            // 🔍 tunggu modal muncul (lebih reliable)
await page.waitForSelector('text=Claim points', { timeout: 5000 }).catch(() => null)

// cek apakah tombol claim ADA
const claimBtn = page.locator('button:has-text("Claim points")')

// cek kemungkinan tombol close (no claim case)
const closeBtn = page.locator('button:has-text("Close"), button[aria-label="Close"]')

// ❗ jika claim button tidak ada → berarti NO POINTS
if (!(await claimBtn.count())) {
    this.bot.logger.info(
        this.bot.isMobile,
        'MONTHLY-CLAIM',
        'No claim button detected → no points available'
    )

    // optional: tutup modal biar bersih
    if (await closeBtn.count()) {
        await closeBtn.first().click().catch(() => null)
    }

    return
}
          

            // 🔁 STEP 3: klik tombol claim
 for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
    this.bot.logger.debug(
        this.bot.isMobile,
        'MONTHLY-CLAIM',
        `Attempt ${attempt}/${this.maxRetries}`
    )

    // pastikan tombol masih ada
    if (!(await claimBtn.count())) {
        this.bot.logger.warn(
            this.bot.isMobile,
            'MONTHLY-CLAIM',
            'Claim button disappeared unexpectedly'
        )
        return
    }

    // ⚡ React-safe click
    await claimBtn.first().evaluate((el: any) => {
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await this.bot.utils.wait(3000)

    // 🔍 cek apakah masih ada
    const stillExists = await claimBtn.count().catch(() => 0)

    if (stillExists === 0) {
        const newBalance = await this.bot.browser.func.getCurrentPoints()
        this.gainedPoints = newBalance - this.oldBalance

        if (this.gainedPoints > 0) {
            this.bot.userData.currentPoints = newBalance
            this.bot.userData.gainedPoints =
                (this.bot.userData.gainedPoints ?? 0) + this.gainedPoints

            this.bot.logger.info(
                this.bot.isMobile,
                'MONTHLY-CLAIM',
                `SUCCESS | gained=${this.gainedPoints} | oldBalance=${this.oldBalance} | newBalance=${newBalance}`,
                'green'
            )
        } else {
            this.bot.logger.warn(
                this.bot.isMobile,
                'MONTHLY-CLAIM',
                `Claim executed but no points gained | oldBalance=${this.oldBalance} | newBalance=${newBalance}`
            )
        }

        return
    }

    this.bot.logger.warn(
        this.bot.isMobile,
        'MONTHLY-CLAIM',
        'Retrying claim button...'
    )

    await this.bot.utils.wait(1500)
}

            this.bot.logger.error(
                this.bot.isMobile,
                'MONTHLY-CLAIM',
                'Failed after max retries'
            )
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'MONTHLY-CLAIM',
                `Error: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }
}
