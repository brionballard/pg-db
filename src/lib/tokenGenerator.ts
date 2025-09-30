function generateUniqueToken(suppress: boolean = true) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''

    for (let i = 0; i < 32; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length)
        result += characters[randomIndex]
    }

    if (!suppress) {
        console.log('\x1b[33m', `Generated Key: ${result}`)
    }

    return result
}

export {
    generateUniqueToken
}
