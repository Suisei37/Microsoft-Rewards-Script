export interface Account {
    email: string
    password: string
    totp?: string
    enabled?: boolean
    geoLocale: 'auto' | string
    proxy: AccountProxy
}

export interface AccountProxy {
    proxyAxios: boolean
    url: string
    port: number
    password: string
    username: string
}
