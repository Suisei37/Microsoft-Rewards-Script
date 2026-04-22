import type { Page } from 'patchright'
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
            // 🔍 STEP 1: ambil points dari card "Ready to claim"
            const claimPointsText = await page.evaluate(() => {
                const label = Array.from(document.querySelectorAll('p'))
                    .find(el => el.textContent?.trim() === 'Ready to claim')

                if (!label) return null

                const container = label.closest('div')?.parentElement
                if (!container) return null

                const pointsEl = container.querySelector('p.text-title1')
                return pointsEl?.textContent?.trim() ?? null
            })

            const claimPoints = Number(claimPointsText ?? 0)

            this.bot.logger.debug(
                this.bot.isMobile,
                'MONTHLY-CLAIM',
                `Detected claim points: ${claimPoints}`
            )

            // 🚫 SKIP kalau 0
            if (!claimPoints || claimPoints <= 0) {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'MONTHLY-CLAIM',
                    'No points to claim | Skipping'
                )
                return
            }

            // 🔍 STEP 2: klik card
            const card = await page.locator('text=Ready to claim').first()

            if (!(await card.count())) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'MONTHLY-CLAIM',
                    'Claim card not found'
                )
                return
            }

            this.bot.logger.info(
                this.bot.isMobile,
                'MONTHLY-CLAIM',
                `Starting Monthly Claim | ${claimPoints} pts Ready To Claim | oldBalance=${this.oldBalance}`
            )     

            await card.click()
            await this.bot.utils.wait(3000)

            // 🔁 STEP 3: klik tombol claim
            for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
                this.bot.logger.debug(
                    this.bot.isMobile,
                    'MONTHLY-CLAIM',
                    `Attempt ${attempt}/${this.maxRetries}`
                )

                const btn = await page.locator('button:has-text("Claim points")').first()

                if (!(await btn.count())) {
                    this.bot.logger.warn(
                        this.bot.isMobile,
                        'MONTHLY-CLAIM',
                        'Claim button not found'
                    )
                    await this.bot.utils.wait(1000)
                    continue
                }

                await btn.evaluate((el: any) => {
                    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
                    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
                    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
                    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                })

                await this.bot.utils.wait(3000)

                // 🔍 STEP 4: cek apakah button hilang
                const stillExists = await page
                    .locator('button:has-text("Claim points")')
                    .count()
                    .catch(() => 0)

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
