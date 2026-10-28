/**
 * LigueLead Web Push service worker.
 *
 * Static and versioned: the client downloads this file and serves it from their
 * own domain (push notifications require the SW to be same-origin). It renders
 * incoming push notifications and reports clicks back to LigueLead.
 *
 * The click endpoint is injected at deploy time.
 */
"use strict";

var CLICK_ENDPOINT = "https://musm85ofkh.execute-api.us-east-1.amazonaws.com/click"; // e.g. https://api-push.liguelead.com.br/push/campaigns/click
var SW_VERSION = "1";

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Notificação", body: event.data ? event.data.text() : "" };
  }

  var title = data.title || "Notificação";
  var options = {
    body: data.body || "",
    data: {
      url: data.url || null,
      campaignUuid: data.campaignUuid || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  var payload = (event.notification && event.notification.data) || {};
  var targetUrl = payload.url || "/";
  var campaignUuid = payload.campaignUuid;

  var tasks = [];

  // Report the click to LigueLead for campaign click tracking (no per-user dedup).
  if (campaignUuid && CLICK_ENDPOINT) {
    tasks.push(
      fetch(CLICK_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ push_id: campaignUuid }),
      }).catch(function () {
        // Best effort: a failed click report must not break opening the URL.
      })
    );
  }

  // Focus an existing tab for the target URL or open a new one.
  tasks.push(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
          if (clientList[i].url === targetUrl && "focus" in clientList[i]) {
            return clientList[i].focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
        return undefined;
      })
  );

  event.waitUntil(Promise.all(tasks));
});
