import React, { useState, useEffect } from "react";
import Layout from "./Layout";
import {
    getProducts,
    getBraintreeClientToken,
    processPayment,
    createOrder,
} from "./apiCore";
import { emptyCart } from "./cartHelpers";
import Card from "./Card";
import { isAuthenticated } from "../auth";
import { Link } from "react-router-dom";
import "braintree-web";
import DropIn from "braintree-web-drop-in-react";
import Product from "./Product";

const Checkout = ({ products, setRun = (f) => f, run = undefined }) => {
    const [data, setData] = useState({
        loading: false,
        success: false,
        clientToken: null,
        error: "",
        instance: {},
        address: "",
    });

    const userId = isAuthenticated() && isAuthenticated().user._id;
    const token = isAuthenticated() && isAuthenticated().token;

    const getToken = (userId, token) => {
        getBraintreeClientToken(userId, token).then((data) => {
            if (data.error) {
                setData({ ...data, error: data.error });
            } else {
                setData({ clientToken: data.clientToken });
            }
        });
    };

    useEffect(() => {
        getToken(userId, token);
    }, [run]);

    const getTotal = () => {
        return products.reduce((cur, next) => {
            return cur + next.count * next.price;
        }, 0);
    };

    const showCheckout = () => {
        return isAuthenticated() ? (
            <div>{showDropIn()}</div>
        ) : (
            <Link to="/signin">
                <button className="btn btn-primary">Sign in to checkout</button>
            </Link>
        );
    };

    let deliveryAddress = data.address;

    const buy = () => {
        setData({ ...data, loading: true });
        // send the nonce to your server
        // nonce = data.instance.requestPaymentMethod()
        let nonce;
        let getNonce = data.instance
            .requestPaymentMethod()
            .then((data) => {
                console.log(data);
                nonce = data.nonce;
                // once you have nonce (card type, card number) send nonce as 'requestPaymentNonce
                // and also total to be charged
                console.log(
                    "send nonce and total to process: ",
                    nonce,
                    getTotal(products)
                );
                const paymentData = {
                    paymentMethodNonce: nonce,
                    amount: getTotal(products),
                };
                // console.log(paymentData);
                processPayment(userId, token, paymentData)
                    .then((res) => {
                        // empty cart
                        // create order
                        const createOrderData = {
                            products: products,
                            transaction_id: res.transaction.id,
                            amount: res.transaction.amount,
                            address: deliveryAddress,
                        };

                        createOrder(userId, token, createOrderData)
                            .then((response) => {
                                emptyCart(() => {
                                    setRun(!run); // run useEffect in parent Cart
                                    console.log(
                                        "payment success and empty cart"
                                    );
                                    setData({
                                        loading: false,
                                        success: true,
                                    });
                                });
                            })
                            .catch((error) => {
                                console.log(error);
                                setData({ loading: false });
                            });
                    })
                    .catch((err) => {
                        console.log(err);
                        setData({ loading: false });
                    });
            })
            .catch((err) => {
                console.log("dropin error: ", err);
                setData({ ...data, error: err.message });
            });
    };

    const handleAddress = (event) => {
        setData({ ...data, address: event.target.value });
    };

    const showDropIn = () => (
        <div onBlur={() => setData({ ...data, error: "" })}>
            {data.clientToken !== null && products.length > 0 ? (
                <div>
                    <div className="form-group mb-3">
                        <label className="text-muted">Delivery address:</label>
                        <textarea
                            onChange={handleAddress}
                            className="form-control"
                            value={data.address}
                            placeholder="Type your delivery address here..."
                        />
                    </div>
                    <DropIn
                        options={{
                            authorization: data.clientToken,
                            paypal: {
                                flow: "vault",
                            },
                        }}
                        onInstance={(instance) =>
                            setData({ ...data, instance: instance })
                        }
                    />
                    <button onClick={buy} className="btn btn-success btn-block">
                        Pay
                    </button>
                </div>
            ) : null}
        </div>
    );

    const showError = (error) => (
        <div
            className="alert alert-danger"
            style={{ display: error ? "" : "none" }}
        >
            {error}
        </div>
    );

    const showSuccess = (success) => (
        <div
            className="alert alert-info"
            style={{ display: success ? "" : "none" }}
        >
            Thanks! Your payment was successful!
        </div>
    );

    const showLoading = (loading) => loading && <h2>Loading...</h2>;

    return (
        <div>
            <h2>Total: ${getTotal()}</h2>
            {showLoading(data.loading)}
            {showSuccess(data.success)}
            {showError(data.error)}
            {showCheckout()}
        </div>
    );
};

export default Checkout;
