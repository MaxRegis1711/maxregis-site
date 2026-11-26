/* Propagação sem cookies de origem (utm_source=chatgpt.com / referer) para /go/whatsapp.
   Usa apenas sessionStorage (volátil, apagado ao fechar a aba). Zero cookies, zero PII. */
(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    var src = params.get("utm_source") || params.get("src") || "";
    if (!src && document.referrer) {
      try {
        var host = new URL(document.referrer).hostname.toLowerCase();
        if (host && host.indexOf("maxregis.com.br") === -1) src = host;
      } catch (e) {}
    }
    if (src) {
      src = src.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 48);
      if (src) sessionStorage.setItem("mr_src", src);
    } else {
      src = sessionStorage.getItem("mr_src") || "site";
    }
    var page = window.location.pathname || "/";
    document.addEventListener("DOMContentLoaded", function () {
      document.querySelectorAll('a[href^="https://wa.me/5527992463839"], a[href^="/go/whatsapp"]').forEach(function (a) {
        try {
          var isGo = a.getAttribute("href").indexOf("/go/whatsapp") === 0;
          var u = new URL(a.href, window.location.origin);
          var go = new URL("/go/whatsapp", window.location.origin);
          go.searchParams.set("src", src);
          go.searchParams.set("page", u.searchParams.get("page") || page);
          var placement = a.getAttribute("data-placement") || u.searchParams.get("placement") || "";
          if (placement) go.searchParams.set("placement", placement);
          var msg = isGo ? (u.searchParams.get("msg") || "") : (u.searchParams.get("text") || "");
          if (msg) go.searchParams.set("msg", msg);
          a.href = go.pathname + go.search;
        } catch (e) {}
      });
    });
  } catch (e) {}
})();
