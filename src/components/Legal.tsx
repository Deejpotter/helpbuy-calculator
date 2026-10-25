import type { ReactElement } from "react";
import { SOURCES } from "../lib/constants";

function Head(props: { title: string; back: string }) {
  return (
    <header className="site-head" role="banner">
      <div>
        <h1>Help to Buy <span className="two">Studio</span></h1>
        <p className="sub">{props.title} - last updated 23 October 2026</p>
      </div>
      <div className="head-actions">
        <a className="btn solid" href={props.back}>Back to the planner</a>
      </div>
    </header>
  );
}

function Sec(props: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="sec">
      <div className="sec-aside">
        <h2 className="legal-h">{props.n}. {props.title}</h2>
      </div>
      <div className="legal-body">{props.children}</div>
    </section>
  );
}

function Page(props: { title: string; path: string; children: React.ReactNode }) {
  return (
    <div className="page legal">
      <Head title={props.title} back="/" />
      <main>
        <p className="legal-lead">
          Short version: this is a free planning tool that explains and calculates. It is not
          financial advice, it makes no promises about scheme numbers staying current, and it
          stores nothing about you anywhere but your own browser. The details are below.
        </p>
        {props.children}
        <footer className="site-foot">
          <a href="/">Planner</a>
          <a href="/terms">Terms of use</a>
          <a href="/privacy">Privacy policy</a>
          <a href={SOURCES.scheme}>Official scheme</a>
          <a href={SOURCES.customerGuide}>Customer guide</a>
        </footer>
      </main>
    </div>
  );
}

export function TermsPage(): ReactElement {
  return (
    <Page title="Terms of use" path="/terms">
      <Sec n="1" title="What this service is">
        <p>
          Help to Buy Studio is a free, browser-based planning tool for the Australian Government
          Help to Buy Scheme (a shared equity scheme administered by Housing Australia). It helps
          you work through repayments on the buyer's share of a home, the government's stake over
          time, buy-back payments, selling outcomes and the scheme's published rules.
        </p>
        <p>
          It is independent. It is not operated by, endorsed by, or affiliated with Housing
          Australia, the Commonwealth, Commonwealth Bank of Australia, any other Participating
          Lender, or any real estate portal. Names and trade marks belong to their owners.
        </p>
      </Sec>

      <Sec n="2" title="Information only - not financial advice">
        <p>
          Everything here is general information and education. We are not licensed to give
          financial product advice, we do not hold an Australian financial services licence, and
          nothing on this site considers your personal objectives, financial situation or needs.
          Numbers shown are illustrations, not offers, quotes or eligibility decisions.
        </p>
        <p>
          Before you make a decision, take these steps: read the official Customer Guide, Fact
          Sheet and General Terms on firsthomebuyers.gov.au; have a Participating Lender (such as
          CommBank) assess your eligibility and borrowing capacity; and consider getting
          independent legal, financial or tax advice from an appropriately licensed professional.
          Only the lender's formal assessment counts. If this tool and that assessment disagree,
          the lender is right.
        </p>
      </Sec>

      <Sec n="3" title="No guarantee the numbers are current or correct">
        <p>
          Scheme settings were read from official pages on 23 October 2026 (income thresholds,
          price caps, share ranges, buy-back rules, review cycles). They change: income thresholds
          and the improvement threshold are indexed every 1 July; price caps are set by policy and
          can be adjusted; lender panels change. We do not promise the information stays current,
          complete or correct, and we do not commit to updating it.
        </p>
        <p>
          Calculations involve modelling assumptions you choose (interest rate, growth, income
          growth). Those are not forecasts. Transfer duty figures are rough estimates on your
          share of the price; concessions vary by state. Borrowing capacity is a heuristic; your
          lender's own income and spending check (including APRA's 3 point rate buffer) governs.
        </p>
      </Sec>

      <Sec n="4" title="Your data stays with you">
        <p>
          The app stores your inputs and compare slots only in your own browser (localStorage).
          Nothing is transmitted to us or stored by us, there are no accounts, and clearing your
          browser storage (or the app's Start over button) removes it. See the privacy policy for
          detail.
        </p>
        <p>
          If you use Share this scenario, your inputs are encoded in the link itself. Anyone with
          that link can read those inputs. Only share scenarios containing details you are happy
          to be public.
        </p>
      </Sec>

      <Sec n="5" title="Listing imports and third-party services">
        <p>
          When you import a property listing, your browser asks public reader relays
          (r.jina.ai and api.allorigins.win) to fetch the page you pointed at, and parses the text
          locally. We send nothing about you. Some portals deliberately block automated readers;
          the app will tell you when that happens. Anything you import is a starting point you
          edit yourself; check the listing site's own terms before using their content.
        </p>
      </Sec>

      <Sec n="6" title="Acceptable use">
        <p>
          Use the planner freely for your own decisions. Do not use the import feature to
          bulk-harvest listings, to circumvent a site's protections, or in any way that breaches
          the reader relays' terms or the law. The site is one static page; there is nothing to
          scrape here.
        </p>
      </Sec>

      <Sec n="7" title="Liability">
        <p>
          The service is provided as is, without warranties of any kind. To the maximum extent
          permitted by law, we are not liable for any loss or damage you suffer from using it or
          relying on it, including decisions about buying property. Nothing in these terms
          excludes, restricts or modifies any right you have under the Australian Consumer Law
          that cannot lawfully be excluded.
        </p>
      </Sec>

      <Sec n="8" title="Availability and changes">
        <p>
          This is a personal project served on a best-effort basis. Features, hosting and these
          terms can change or stop without notice. The version on this page is the one that
          applies; continued use after a change means you accept it.
        </p>
      </Sec>

      <Sec n="9" title="Law and contact">
        <p>
          These terms are governed by the laws of Victoria, Australia. Questions, corrections or
          issues: open a GitHub issue at
          <a href="https://github.com/Deejpotter/helpbuy-calculator/issues"> the project's issues page</a>.
        </p>
      </Sec>
    </Page>
  );
}

export function PrivacyPage(): ReactElement {
  return (
    <Page title="Privacy policy" path="/privacy">
      <Sec n="1" title="The short version">
        <p>
          We collect nothing. There are no accounts, no cookies, no analytics and no trackers.
          Your numbers live in your browser and nowhere else.
        </p>
      </Sec>

      <Sec n="2" title="What is stored on your device">
        <p>
          The app saves the scenario you are working on and your three compare slots in this
          browser's localStorage, under the keys <code>helpbuy.studio.state.v1</code> and
          <code> helpbuy.studio.slots.v1</code>. The contents are the figures you type (price,
          income, deposit and so on) and slot labels. Nothing is sent to any server, synced or
          backed up by us. You can erase it any time with the Start over button, your browser's
          clear-site-data control, or by using a different browser or private window.
        </p>
      </Sec>

      <Sec n="3" title="Shared scenario links">
        <p>
          Share this scenario puts your inputs into the link's fragment. The data is not sent to
          us, but anyone who has the link can read those inputs from it. Treat a shared link like
          a screenshot of your numbers: share only what you are comfortable being seen.
        </p>
      </Sec>

      <Sec n="4" title="Property listing imports">
        <p>
          Listing pages are fetched by your browser through public reader relays
          (r.jina.ai and api.allorigins.win). Those relays receive the listing address you pasted
          plus ordinary request metadata (such as IP address and user agent, which their
          infrastructure sees the same way any visitor would). We do not send them anything about
          you, and we do not log or keep the import. Their own privacy policies govern what they
          do; if that concerns you, skip the import and enter the property details manually.
        </p>
      </Sec>

      <Sec n="5" title="Hosting and network logs">
        <p>
          The site is a static bundle served from self-hosted infrastructure in front of a
          Cloudflare tunnel. That infrastructure (the web server, the tunnel, and Cloudflare) may
          keep standard technical access logs such as IP address, timestamp and requested URL.
          Those logs belong to the infrastructure operators under their own policies; we do not
          use them for profiling, and this site has no server-side application that could attach
          your visit to any scenario data.
        </p>
      </Sec>

      <Sec n="6" title="If you contact us">
        <p>
          Feedback and issues are handled through public GitHub issues on the project repository.
          Whatever you post there is public and governed by GitHub's privacy policy. Please do
          not include sensitive personal information in issues.
        </p>
      </Sec>

      <Sec n="7" title="Children">
        <p>
          The tool is aimed at adult home buyers and does not knowingly collect anything from
          anyone, children included.
        </p>
      </Sec>

      <Sec n="8" title="Changes to this policy">
        <p>
          This policy can be updated as the tool changes; the current version is always this
          page. The last update date is shown at the top.
        </p>
      </Sec>
    </Page>
  );
}
