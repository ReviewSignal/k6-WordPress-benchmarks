
export const isOK = {
    'response code is 200': response => response.status == 200
}

export const itemAddedToCart = {
    'item added to cart': response => {
        return response.cookies.woocommerce_items_in_cart
            && response.cookies.woocommerce_items_in_cart.find(cookie => cookie.value > 0)
    }
}

export const cartHasProduct = {
    'cart has product': response => response.html().find('.woocommerce-cart-form').size() === 1
}

export const orderWasPlaced = {
    'order was placed': response => response.url.includes('/checkout/order-received/'),
}

export const pageIsNotLogin = {
    'page is not login': response => {
        return response.html().find('button[name="login"]').size() === 0
            && response.html().find('input[name="password"]').size() === 0
    }
}

export const isWPLoginOK = {
    'response code is 200': response => response.status == 302
}

export const wpIsNotLogin = {
    'page is not login': response => {
        return response.html().find('input[name="log"]').size() === 0
            && response.html().find('input[name="pwd"]').size() === 0
    }
}

