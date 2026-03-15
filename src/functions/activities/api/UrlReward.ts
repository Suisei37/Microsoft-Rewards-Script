import type { AxiosRequestConfig } from 'axios'

import type { BasePromotion } from '../../../interface/DashboardData'

import { Workers } from '../../Workers'

export class UrlReward extends Workers {

private cookieHeader: string = ''

private fingerprintHeader: { [x: string]: string } = {}



private gainedPoints: number = 0

private oldBalance: number = this.bot.userData.currentPoints


public async doUrlReward(promotion: BasePromotion) {

const hasRscRewards =

    this.bot.rscRewards &&

    this.bot.rscRewards.size > 0



if (hasRscRewards) {



    this.bot.logger.debug(

        this.bot.isMobile,

        'URL-REWARD',

        'Detected NEW Rewards UI (RSC)'

    )



    return await this.doNewUrlReward(promotion)

}



if (

    this.bot.requestToken &&

    this.bot.requestToken.length > 20

) {



    this.bot.logger.debug(

        this.bot.isMobile,

        'URL-REWARD',

        'Detected OLD Rewards UI'

    )



    return await this.doOldUrlReward(promotion)

}



this.bot.logger.warn(

    this.bot.isMobile,

    'URL-REWARD',

    'Skipping: No compatible reward API detected'

)

}



/*

=========================

OLD UI METHOD

=========================

*/



private async doOldUrlReward(promotion: BasePromotion) {



    const offerId = promotion.offerId



    this.bot.logger.info(

        this.bot.isMobile,

        'URL-REWARD',

        `Starting OLD UrlReward | offerId=${offerId}`

    )



    try {



        const cookies = this.bot.isMobile ? this.bot.cookies.mobile : this.bot.cookies.desktop



        this.cookieHeader = cookies

            .map(c => `${c.name}=${c.value}`)

            .join("; ")



        const fingerprintHeaders = { ...this.bot.fingerprint.headers }



        delete fingerprintHeaders['Cookie']

        delete fingerprintHeaders['cookie']



        this.fingerprintHeader = fingerprintHeaders



        const formData = new URLSearchParams({

            id: offerId,

            hash: promotion.hash,

            timeZone: '60',

            activityAmount: '1',

            dbs: '0',

            form: '',

            type: '',

            __RequestVerificationToken: this.bot.requestToken

        })



        



        const request: AxiosRequestConfig = {



            url: 'https://rewards.bing.com/api/reportactivity?X-Requested-With=XMLHttpRequest',



            method: 'POST',



            headers: {

                ...this.fingerprintHeader,

                Cookie: this.cookieHeader,

                Referer: 'https://rewards.bing.com/',

                Origin: 'https://rewards.bing.com'

            },



            data: formData

        }



        const response = await this.bot.axios.request(request)



        await this.processBalance(response.status, offerId)



    } catch (error) {



        this.bot.logger.error(

            this.bot.isMobile,

            'URL-REWARD',

            `OLD UrlReward error | offerId=${promotion.offerId} | message=${error instanceof Error ? error.message : String(error)}`

        )

    }

}



/*

=========================

NEW UI METHOD

=========================

*/



private async doNewUrlReward(promotion: BasePromotion) {



    const offerId = promotion.offerId



    this.bot.logger.info(

        this.bot.isMobile,

        'URL-REWARD',

        `Starting NEW UrlReward | offerId=${offerId}`

    )



    try {



        const cookies = this.bot.isMobile ? this.bot.cookies.mobile : this.bot.cookies.desktop



        this.cookieHeader = cookies

            .map(c => `${c.name}=${c.value}`)

            .join("; ")



        const fingerprintHeaders = { ...this.bot.fingerprint.headers }



        delete fingerprintHeaders['Cookie']

        delete fingerprintHeaders['cookie']



        this.fingerprintHeader = fingerprintHeaders



        const rscHash = this.bot.rscRewards.get(offerId)



        const hash = rscHash ?? promotion.hash



    



        const payload = JSON.stringify([

            hash,

            11,

            {

                offerid: offerId,

                isPromotional: "$undefined",

                timezoneOffset: "-420"

            }

        ])



        const request: AxiosRequestConfig = {



            url: "https://rewards.bing.com/dashboard",



            method: "POST",



            headers: {



                ...this.fingerprintHeader,



                Accept: "text/x-component",



                "Content-Type": "text/plain;charset=UTF-8",



                "Next-Action": this.bot.nextActionToken,



                Cookie: this.cookieHeader,



                Referer: "https://rewards.bing.com/dashboard",



                Origin: "https://rewards.bing.com"

            },



            data: payload

        }



        

        const response = await this.bot.axios.request(request)



        await this.processBalance(response.status, offerId)



    } catch (error) {



        this.bot.logger.error(

            this.bot.isMobile,

            'URL-REWARD',

            `NEW UrlReward error | offerId=${promotion.offerId} | message=${error instanceof Error ? error.message : String(error)}`

        )

    }

}



/*

=========================

BALANCE CHECK

=========================

*/



private async processBalance(status: number, offerId: string) {



    const newBalance = await this.bot.browser.func.getCurrentPoints()



    this.gainedPoints = newBalance - this.oldBalance



    if (this.gainedPoints > 0) {



        this.bot.userData.currentPoints = newBalance



        this.bot.userData.gainedPoints =

            (this.bot.userData.gainedPoints ?? 0) + this.gainedPoints



        this.bot.logger.info(

            this.bot.isMobile,

            'URL-REWARD',

            `Completed UrlReward | offerId=${offerId} | status=${status} | gainedPoints=${this.gainedPoints} | newBalance=${newBalance}`,

            'green'

        )



    } else {



        this.bot.logger.warn(

            this.bot.isMobile,

            'URL-REWARD',

            `No points gained | offerId=${offerId} | status=${status}`

        )

    }



    await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 10000))

}

}
