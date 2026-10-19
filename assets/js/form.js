// Contact form: progressive enhancement over a plain <form action="https://api.web3forms.com/submit" method="POST">.
// Without JS the browser posts the form natively. With JS we send JSON and show an inline message.

export function initForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const status = document.getElementById("form-status");
  const button = form.querySelector('button[type="submit"]');

  const say = (text, kind = "") => {
    if (!status) return;
    status.textContent = text;
    status.className = `form__status${kind ? ` is-${kind}` : ""}`;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const data = new FormData(form);
    if (data.get("botcheck")) { // honeypot filled: pretend it worked, send nothing
      say("Thank you. Your inquiry has been sent.", "ok");
      form.reset();
      return;
    }

    if (button) button.disabled = true;
    say("Sending…");
    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.success) throw new Error(out.message || `HTTP ${res.status}`);
      say("Thank you. Your inquiry has been sent.", "ok");
      form.reset();
    } catch (err) {
      console.warn("Contact form failed:", err);
      say("Your message could not be sent. Please try again in a moment.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  });
}
