"use strict";

/*
 * This file is based on the SES module for Nodemailer
 */

// NB! Amazon SES does not allow unicode filenames on attachments!

var AWS = require('aws-sdk');

// Expose to the world
module.exports = AWDSDKTransport;

/**
 * <p>Generates a Transport object for Amazon SES with aws-sdk</p>
 *
 * <p>Possible options can be the following:</p>
 *
 * <ul>
 *     <li><b>accessKeyId</b> - AWS access key (optional)</li>
 *     <li><b>secretAccessKey</b> - AWS secret (optional)</li>
 *     <li><b>region</b> - optional region to send service requests to. (defaults to us-east-1)
 * </ul>
 *
 * @constructor
 * @param {Object} optional config parameter for the AWS SES service
 */
function AWDSDKTransport(options) {
    options = options || {};
    options.apiVersion = '2010-12-01';
    options.region = options.region || 'us-east-1';

    this.options = options;

    this.ses = new AWS.SES(this.options);
}

/**
 * <p>Compiles a mailcomposer message and forwards it to handler that sends it.</p>
 *
 * @param {Object} emailMessage MailComposer object
 * @param {Function} callback Callback function to run when the sending is completed
 */
AWDSDKTransport.prototype.sendMail = function (emailMessage, callback) {
    // SES strips this header line by itself
    emailMessage.options.keepBcc = true;

    this.generateMessage(emailMessage, (function (err, email) {
        if (err) {
            return typeof callback === "function" && callback(err);
        }
        this.handleMessage(email, callback);
    }).bind(this));
};

/**
 * <p>Compiles and sends the request to SES with e-mail data</p>
 *
 * @param {String} email Compiled raw e-mail as a string
 * @param {Function} callback Callback function to run once the message has been sent
 */
AWDSDKTransport.prototype.handleMessage = function (email, callback) {
    var params = {
            RawMessage: { // required
                Data: (new Buffer(email, "utf-8")).toString('base64') // required
            }
        };
    this.ses.sendRawEmail(params, this.responseHandler.bind(this, callback));
};

/**
 * <p>Handles the response for the HTTP request to SES</p>
 *
 * @param {Function} callback Callback function to run on end (binded)
 * @param {Object} err Error object returned from the request
 * @param {Object} data De-serialized data returned from the request
 */
AWDSDKTransport.prototype.responseHandler = function (callback, err, data) {
    if (err) {
        if (!(err instanceof Error)) {
            err = new Error('Email failed: ' + err);
        }
        return typeof callback === "function" && callback(err, null);
    }
    return typeof callback === "function" && callback(null, {
        messageId: data && data.MessageId && data.MessageId + "@email.amazonses.com"
    });
};

/**
 * <p>Compiles the messagecomposer object to a string.</p>
 *
 * <p>It really sucks but I don't know a good way to stream a POST request with
 * unknown legth, so the message needs to be fully composed as a string.</p>
 *
 * @param {Object} emailMessage MailComposer object
 * @param {Function} callback Callback function to run once the message has been compiled
 */

AWDSDKTransport.prototype.generateMessage = function (emailMessage, callback) {
    var email = "";

    emailMessage.on("data", function (chunk) {
        email += (chunk || "").toString("utf-8");
    });

    emailMessage.on("end", function (chunk) {
        email += (chunk || "").toString("utf-8");
        callback(null, email);
    });

    emailMessage.streamMessage();
};
