// Cloudflare Worker: lively-dew-924c
//
// Routes:
//   POST /mailerlite-subscribe  - adds a subscriber to a MailerLite group
//   GET  /verify-purchase       - verifies a Stripe Checkout Session and
//                                 reports which gate it paid for
//   GET  /secret-place/download - verifies a Secret Place purchase and
//                                 streams back the guide PDF
//   GET  /restore-access        - looks up which gates an email has already
//                                 paid for, for a buyer restoring access on
//                                 a new device/browser

const STRIPE_API = 'https://api.stripe.com/v1';

// Each gate sells through its own Stripe Payment Link (see THE-QUIET-AUTHORITY's
// gate-*.html — this repo no longer keeps its own copies, see worker/README.md).
// A verified Checkout Session's payment_link.url is matched against this
// map to determine which gate the buyer paid for.
const GATE_PAYMENT_LINKS = {
  one: 'https://buy.stripe.com/eVqfZh8Ba8Od0Es8YGcQU0w',
  two: 'https://buy.stripe.com/6oU3cv8Bac0pcna0sacQU0x',
  three: 'https://buy.stripe.com/9B600j9FefcB0EscaScQU0y',
  four: 'https://buy.stripe.com/dRmdR9g3CfcB72Qgr8cQU0z',
  five: 'https://buy.stripe.com/6oU00j4kU9Sh3QE7UCcQU0A',
  six: 'https://buy.stripe.com/eVq8wP8Ba0hHgDqej0cQU0B',
};

// Confirmed against THE-QUIET-AUTHORITY's gate-one.html canonical/og:url
// tags (the copy actually served at this domain — see worker/README.md).
// Requests from origins not in this list still get a valid JSON response,
// just without CORS headers, so the browser blocks the read.
const ALLOWED_ORIGINS = new Set([
  'https://sanctuary-grace.com',
]);

// Each gate's own MailerLite "Buyer" group (from the MailerLite dashboard).
// Joining one of these groups is what triggers that gate's already-built
// 11-step welcome sequence automation (currently disabled, waiting).
const GATE_MAILERLITE_GROUPS = {
  one: '193979375492793939',
  two: '194025316835919214',
  three: '193578269634725820',
  four: '193578191164540344',
  five: '193578072636655259',
  six: '193576760955110675',
};

// The Secret Place: Architecture of Intimacy — a standalone paid guide,
// separate from the six Circle of Silence gates above.
const SECRET_PLACE_PAYMENT_LINK = 'https://buy.stripe.com/6oU8wPbNmggFevigr8cQU0F';
const SECRET_PLACE_MAILERLITE_GROUP = '192667224052336080';
const SECRET_PLACE_PDF_FILENAME = 'The-Secret-Place-Architecture-of-Intimacy.pdf';
const SECRET_PLACE_PDF_BASE64 = 'JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIgL0Y0IDUgMCBSIC9GNSA3IDAgUgo+PgplbmRvYmoKMiAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjEgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iagozIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhLUJvbGQgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YyIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNCAwIG9iago8PAovQmFzZUZvbnQgL1RpbWVzLUJvbGQgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQmFzZUZvbnQgL1RpbWVzLUl0YWxpYyAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjQgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago2IDAgb2JqCjw8Ci9Db250ZW50cyAxOCAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDE3IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago3IDAgb2JqCjw8Ci9CYXNlRm9udCAvVGltZXMtUm9tYW4gL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0Y1IC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKOCAwIG9iago8PAovQ29udGVudHMgMTkgMCBSIC9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0gL1BhcmVudCAxNyAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKOSAwIG9iago8PAovQ29udGVudHMgMjAgMCBSIC9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0gL1BhcmVudCAxNyAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKMTAgMCBvYmoKPDwKL0NvbnRlbnRzIDIxIDAgUiAvTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdIC9QYXJlbnQgMTcgMCBSIC9SZXNvdXJjZXMgPDwKL0ZvbnQgMSAwIFIgL1Byb2NTZXQgWyAvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJIF0KPj4gL1JvdGF0ZSAwIC9UcmFucyA8PAoKPj4gCiAgL1R5cGUgL1BhZ2UKPj4KZW5kb2JqCjExIDAgb2JqCjw8Ci9Db250ZW50cyAyMiAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDE3IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iagoxMiAwIG9iago8PAovQ29udGVudHMgMjMgMCBSIC9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0gL1BhcmVudCAxNyAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKMTMgMCBvYmoKPDwKL0NvbnRlbnRzIDI0IDAgUiAvTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdIC9QYXJlbnQgMTcgMCBSIC9SZXNvdXJjZXMgPDwKL0ZvbnQgMSAwIFIgL1Byb2NTZXQgWyAvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJIF0KPj4gL1JvdGF0ZSAwIC9UcmFucyA8PAoKPj4gCiAgL1R5cGUgL1BhZ2UKPj4KZW5kb2JqCjE0IDAgb2JqCjw8Ci9Db250ZW50cyAyNSAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDE3IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iagoxNSAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDE3IDAgUiAvVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKMTYgMCBvYmoKPDwKL0F1dGhvciAoXChhbm9ueW1vdXNcKSkgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MDkwNTAyNDgzMCswMCcwMCcpIC9DcmVhdG9yIChcKHVuc3BlY2lmaWVkXCkpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MDkwNTAyNDgzMCswMCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0IChcKHVuc3BlY2lmaWVkXCkpIC9UaXRsZSAoVGhlIFNlY3JldCBQbGFjZTogQXJjaGl0ZWN0dXJlIG9mIEludGltYWN5KSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjE3IDAgb2JqCjw8Ci9Db3VudCA4IC9LaWRzIFsgNiAwIFIgOCAwIFIgOSAwIFIgMTAgMCBSIDExIDAgUiAxMiAwIFIgMTMgMCBSIDE0IDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKMTggMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggNTY0Cj4+CnN0cmVhbQpHYXNJYz5BTXRJJ1JvZVtwYD9jaFcnN0w0Z08mOC1LdG1tQ0U9N0s2R2BJdSRgLSpZSCVKZmBbRzNpUFYvZjYuWEdMMU9xS1RKRmBzJFsqPWM+Xkg+T0A2TVwuQTtpT18pcipzIVpFQ1svMHFTVyRsKWNdSFwjalE3XDBZbkNRaytrLCNXLCcrXzdCW1dvLyUkWmQ5KDc7Y1FMQDYiKlA9NCViQiVhQWFzY0Qock46QFdhby1jPkZdLV1OYFlDMVRbcHBmdSImKjVFVUI0b1xEQClddE1wbDtEW1RhYSVmMnI6Si1MQFg3SEchPSliai8rQUpiKSZETjokVDhHJFRIcUxNPXA0NWZEMDxtLDs9KmY2VWpAL21EUWRmZUssWTA7WCFFXFdpMCs3ZydRIltVLmVfWD5QRUkpYT1MKkI0NjU5OHIoIzlrcDNTMSUtNU91PWFaUnJHbWI3QzRtXlgyW0pdQ2tXZUA6KTxRNmAkUl5WU1pLOD1wOUU1OmYsTTU/SFhPdChXTlU5SklMZ3BFbkU9XVVvLGlgI14xZSlFJ3QwKlNrODk0UlEuSiJgKXFZcV9cb1BcQU5yRFI+XUVOPzZJKCQwTVtiYkhHbjUrTm1fOkhdRGpLMzo8Um9WbGdzIU8iLHJOVEBKL2k9PW0pN0ctTztVciFgSXViLylGXkIsZlxOPTZhXDVbamBbO0EnNl5JbzY4KlJYLFM2VWZDJVlFSWRAJVslRyUjI1BvXC0zfj5lbmRzdHJlYW0KZW5kb2JqCjE5IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDEzOTYKPj4Kc3RyZWFtCkdhdG06bFlrTjkmSEE/OmltOktoaSteY1tZQyUzY1hCak9sPUdAXzUkTTRdTlNQQEJEV0tMNDtyVipxIUNhRWVZQUtEJFhJU188WW1lPTU0JDhbIiluXCkiKWhKRCwqRzpCPSpDcG9FQDhIRzsyR2U2ITVIQm9VcS9zXSc1Yjs7am1GRl9yK2phPT06akgvSEFIQnBqW2puITpvSkQ2WEI/MFFUXiVcJm9pYzxxWjJjTTY4PDpEXVdISTE7WjFASWtMMHEySl88NnM/XFssLEd1JT49K0pnQnRAUXJCL1ZFb08hOkRmVWBAZm8lKDF0ZFkjKm4nWlwnQTRoVV5uNkJaX0FTQllrL0koV0A0VT9kK2g6SmgjJG5xLW0ncFksTCJOOyQsRjQ1UVUtOT9FTWdja1NpJTpHbVtuKiskXV0mam4wPWpnLSVjQjorNzZNcl0tPkBxR10iWi5IV0NAMWxdJmlAa1BNJWRtSWJgMWdsPTJpRHQ0PSt1Qz82TEIvO0Y4a2BWO1ola2YmOz9CIzVNUiFzJEUuZmtVSSpiSHI3UjY1JSZlQGtENTZXLHMmKSpLLlooTUNBZ1s2PGk5QCVEZkEpMWg6TUUlJHAwKkAxXnBEY1lFRkI0YjlGciJ0P05SJCVqTGBPcyJcKjNaMnE1XjFjQHVjMDMnZDk1K0EkZUMuai5VSWU3Z0JNbSkzZCJxb2EtI1MvS2U/VTtAWiVeVUVoRGdDYilIZCV0b1lIWiMsJEpbTFZkWy45YiVmNW9DYkA8KyoxU2RqaVVWbz1dSS9XKF4kcStBPWcyLFtAPzFIJUYwN2FRNWVeN2BHWShVNHNrMWNkRThkOklwYms9RWNTdFRHJkBUSzE0Ii8nVjs+VmkkRS1sU0E+IiU3JFc5LCo/aVRPPFpQcEw3NCVHW0xob0VET0xIJyJJLyZMMStpNmQ4JnQoJ0s8VTguX0lMaS9Ma2Y8UUIqM0FOWj8ibVZxVilbL3JjVWR1SVxUP0A6NStsaG4pSCE3T1V1dHFDWWxgZmpXT0FmQD4qQ2wkKiorTl9OYEBBb2UiSDUkS3AscTlyTT1Jbk1NKUppOjYqUy9aRigwZydbRG87NVNFTG4xRi4qdUFmInRaUU8ma3EhRGxBIVxYLGI3XG49Yi5aKURtW1A5JyFcKThoSmJZKVtQOzw7bWErcWNUKVoxRmZrZDhWTD1bZ1ZUMUdCZiE0NVAmY09pb3EiQ1IyWWtSbGhAPV9tT04/UyZbTE8vZylfITpTWCIxNCdtSEhyPVojI0dpTnNYJD5rVTAsRjJsUig1UWNMZTpWYGg3WGswWEBPaHVbWlQxTDs0SDQ/JSl0I05wOlgzOjs3UDI9UUo/I3UjQT01KkJQTWR1UmxcXUNRck0jIiJwWFFeOHM0bDRMJF9CRlVYalM8OEVHNG1wJjIyK3NdPz87WHBmRDE+TGtcLFJvVE1jTzFxOlVjKyw1X2M1MGMmKl5rUiI6SC9xWGxcNFkscEgzKGhTQzlUImNaaUhEajUtNS8uZm1CcjpoNWFXXFxHMSdSNiNJLi9ObyhpQlE1Ql1JMGpUJlNwcj48X14xWGFiX2tYL0JzWj0sWylTMSlIaXNFTlI8TkEzc3M/biUhJzJOPSZWMz1DTFU4TSc2VDFFYlEjPWhpNl5xVVtyXHFxV2ZoTEJhOypVOkhkRklmMmUkcEMxWitMVVYvJWsnJEFaXzpqPTYrZypyWWduSnU5IyRpXDliOlx1W0IlcDMsMEw9SUFAIm0iPl1YVUEnOChkLmhOKz5hUzFtQEBXISVjYiFdNFpBP0smU2JOXFovTCtoVycpIzgucihvR0U4TUU+QjdDJCVdKXEnfj5lbmRzdHJlYW0KZW5kb2JqCjIwIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDk2Ngo+PgpzdHJlYW0KR2F0bThnUSdgOiY6Tkg+MzkkcDEnJnFdOG5xJy1eMEIqYXVPRWJjN2wsR1FiTXNWKVBwUGRxYWpqJGI8J2UsIVpqI0s7OWM8KTROOCZZLkohOkRfU29oW25hQkpwRGo7UDg7cSNMMUJSJzYwPUAvV3BNTU9YMmwnaS07T1VYMUhIOWpNYG4hT0NXWCkvSVU0Wyc8V1c2YjMqRkIvdEhEZy5xYlJEbS9HZk9hS0Q8NktdWWBoSC1PWWc4NixVLzhNRXVMNVUkT1koKTs+Klo8NypcLFMhQCpgJC5PdSZaWSgkMDtOS14tXllBIk9SbmU9PTJiPl4/RFdSa0AjQ0AjWCFNaGdSOlpAOkVjc10jK09WPyY0cy43ZWlcbUZoajZZSUpHOT0icUp0IkJRLGIsWVVnXylxQWdiUmdFOVRzUiRrO0EjQWJhc3Q6Kk1oN3VlOCZnaD0/LWY0M0Z0JTNMMWJXayVELzJrVmhMPWw7W0FTL0UyNVkwaU5KJS9rZ2JRbGhoTjNTXkdtRGhAOl9zalcobGJsSz1yL0spNVwhLSxZMVVATztfJjFkIlNMMzpqLFhfM2NxNjtQcyxBIitoUkpTcSI8ZDYocj1LYjIvS1tnNVtXWCxwTnMnWVFrOzwwTD9vQEhuJzNZI14iUUJURGlNczI9QiMwJGo2LnQyalVOailNTCVddV9LaiJkLVh0WFlMUjhlQW03YEpBYy5LTTBqQD84J1cnVS9xRkltV0lQal46Q2hGNSFyWGxNQWRwaSc5dUp0K19fXz5RYVNPOmtjbks2ISYoMU9AXE5sX29ZXlNoKWg9YS09TCRNVzBkRk1CLFw8VDE7PTk8VkFcXmA2SyJpSGk0czxTMTxrZipFRFBdO2AxVyU8Vy0oNFVeWjc+R2FIQGI5TEU/Q15LcXFKXXRHR2tVPlk0ZkoqUmVcXDxcQzNPQWBCPWRCRV5tak0sUFlOQ1dTTDlddTIzLjRzJDZiLiwvSk5wSFFwPjBFIWhGOVNpLW5KSEp0OVM0NUJAJ09XcD5YbUNmRG4yZUYlVz1FUipTMzItTi1KRzJOZ05mJ1pTdTFGR2ohdS5NbjZEUmsnKWtyaEFEZ3BiQExEXjlLbSlWRG8wRmBdbl1ndVhuPWZmUmJkPTArLGdWN2ErZ0xHRGBeKy5FZ00kXFczUnBgcFpiOm1TXl5rKzErZFtfPDRecy9JKipKN0VGYDkwS1BPJjNqYE1SJGQoVk84OSZRQT4jczVGZEdEUHRwMDVsXGptIywzZ2o1Xy5bMEhFQ34+ZW5kc3RyZWFtCmVuZG9iagoyMSAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCA5MzAKPj4Kc3RyZWFtCkdhdG04Z01SWlomOk1sK04tSXJsQUUoOyMwO28lSFxWWyZgTU5JXG9DYVFEcUc5Kz9RViMwbkZdaClDMjhkTUZ0ZzVDLzthNjFbN2lAcS1lcWcyMEBTRUI+I011c1M1VCooLVYiU2tRNFA3TipQcGEuYWY9VEJsXT1ATzZDU1lePWgscEJLSFJaJT5WNW85aWojZz9hQ1xiSWUqI15KazwiLjhsLUpdZy0mSUlbaWEsS1JWZXJuTzJwVSRFYXRQMi49JSFYX2g1NFE4SXRrU189ZGo4Zm5eT1tBISpMV1ZhLy48YDpvSlgkTEJCV05bTyQqVDppUVtAWVNCRW9WK2oidVtNQllgWT02OzAycClFdHFJSE1lJ0RwXlloTV9AbFBcUDJjXEpMRUdBWz5wJyJjM00lM19TPGM5WCUlTVwqZkhdUUlIKidlNGpHY3VZIi5hPkdDKylcUzloNFZnQyVNYzI+RDhlYyVEISwyMkheQDglV2xLUVhfJSJJSm5mZyYzWXNrOFdhOmRbX0VvSXNncC5lTUZeblxlPFZ0Oj82VVNDWWtHJ21rOSwnVWBlRlxJJkRBTnBCNiIqbzY1OkhlaldCbCcxLWdiQV49JDAtTD43TmE9N15nbiJHLD9dLU9nSE5LJHIwWUwuXzZiKl0ic2c3NCtcY0lcTWZfTyROcW1zVzNxbltfZypPbmZgb1ZbTGtWJU5HZV9jYjgiQVJWIT1TO1pIX0ZLTyZDXCclVklPUyowIW1zUF1mSEVsQDtIJGxoT2lLQyxtQWo5OyttRWBZNydsMEhSb2N0YmtTZzE7XG0hbkY1TytWcUk/dWlMSVtnSUw2b3ElYmhIXEpyS3RvPSNnWD50PUJkVjE/KjNJPjs9K1ZsOFxDP2tkaXBMbDdFSCpoNGhAY1RqOSIhIzNZTmJHPEV1T2ozaVEoUWUtZ25wNGVwJCw7c0RcKW0hbjhjMF9oRCJpSTw5SXEoUUJvXHJxcmJCcVZfZ1M6J1hHbilWJSxQckZpL3JkIXJuOyZdIj0jN0lwYGwiS1AvNFVnUis6VztoYTBTVUNMQ1laXVYyYDdMZm5wUC1DOVRcP2hLY15vVmUqVm5MUlZvV1U/PjgyZTdhNTE6NXA5dUYkWUIoYjROYXJXQHNXLSYvV0kmcj82YTFYRDImaUQvOD02YGdVVGNsLGQrRjNiRUQhVDU2OjdDTU8mIlxDXFIuIjxWSXJaaSJxSzVyRjV+PmVuZHN0cmVhbQplbmRvYmoKMjIgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggNzk5Cj4+CnN0cmVhbQpHYXRtOD8jUzFXJjpEZy0pImY9SE9pZERUa21KdThQUUZhNj4rZUs5XF8tNkNMamA/QFZlUSxuSGZsYSZRNGVkITk5LUFeY2c5SDJUInBeOGlTSV1IXU1BImZYYW9vJygoZC9VLDVtPV1GUldjX21RMENIbzhzPTlTKyRZZnBRP3FyX3VbTG5TO3IjQklMdT4oJkMjVTw9Q01YWytLWk84YTQpOjAoM2ZROXBfKU8vZGRLXzY9SS47MjRDRiRvXlIsLTtxJEIucSRCYDopbFVUcSsmWDJGSCFmNGNsOWNWXko7RHBQc1ImdEAraUpVUHBCXUYmKSlvVWNJJyFhYzA3LkhLVjowOyNxTHREKkA2XHQ4TiZsMih0WCcxPlM4LUhGQElYKG5jbD5SIiYzOCU1TiZHRmxrS1EsXy9qJChwTldgP0JfOnMjLD5eZ2o9R0tpcitAUGczXEVGSzIlaV9hUlUoXjkiOVBnKzpXLzEwXV4xTT1TQVcnNlBOckQpdTc4WEtXbSswMDxpJzFcaHFnW0JyZGZDbCk9K3BKb1BpJTNwKG5tI1cqVS51T0g4L1NkRFlGKDwuPCcyRDhePEdCZzRTN3UmQC47UG0iRlg4Z15mbDxINCk7VVUhZmZIV2w9RGEtdTYrUz9RUVRWY29MaGUkcFE5U0dTbCskbjBXRkcrSEJAbm9cV1pmSmYoPj5pbm4qZzZEUEAzRnNJMkJRO2cqIzFyXCxfUCtWOC85RksmT1wyailXXmZcdEFPNTZRRG1KWDBQK0ksTzNudW1zbWNKbiRrbV9MUSJbLEdXJCNvcWU+aCsnImE7R1FgUGU7Nj5daUlQImQwXGp0OWY7PSQkUVtkMnJPSmo/Rj11biM7c1dTUTJvIiFIIVlmYyxvNlAtJ00mdXBuJEdCYkJsUjY1NS0kalVLblg4QWYnbUouJmFFQFkmK1pOVHAiLyllIUI5RkFEPU8xY1YzYDNnWy5WcHEiW2hgQnRzNzE5O3JfUFZlV181WCMxNnVEOmhVcURsWzNZXS4pZXUyXz1iQ0ldKkYmVDFaMmJaTn4+ZW5kc3RyZWFtCmVuZG9iagoyMyAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCA3OTUKPj4Kc3RyZWFtCkdhdG04PkFxdEUnUm9NUzM4LjtkV19iZU9uVVFBNj9uZWk/K3NzLCFHZmFZNVJgKjBnI2w0Mzc0Nyo2QTddQTQ1OSZgTGhrTzNILj9xcU1acFVnTk9QSlBGQCMpa3BYISNCZVtBRVdHP1MsQVlYYy1AYTIzNWdjJiQlNSkxPzV1RitqRmNWI2woIUNIcksqb1hXOSZcSVorS1FqQS49Z2RPTGlUaWV0JkJQSXRSNSVaTDxtZ1lVSC4uSEBRXFVwSUw2bkdSUFckKGxLVmJuaDxUVitnRFgkIzhURCJgJ0pmU1VLQ09gJmYrKHQ/cVEpTldKajBHR01sIS0qUE5XP2ohNWJFUzpzZzQ8ImdKQTU8OGNkJWhKYDFzMiJBK01uNEooKkhBVFdJZi9eLmsmOlBaaGpcak8hZitSWSF0SEBAJ29FcSVcbCtnWGtZNi9yUGs3LilWNGouWUM9cz1DUy9GRT5CTT1DQl1JcElDNiQ9QGJLI20+R29gL1EnJ0pzMSk6LWFmTDYzSE9Xaj5fNE1bPzljLFg2RDJnUVZNTSFKQWZkNTowWidcVGFWclNqJG1UbEUvVjlqMXFGJHA8cV8nWSNhKydBO1ZGTCdaN2JLTT41LyN1PWRVTz9jMkozRihLdE8/OT0nUHJncy5KL2FtYDI5Tlo9QEtGMV87dSsoLEVcQkAnXjsjcVpAQyRgRD5IYFJXJz1oUDkyWiUlcVJlL09wQ2RbK00yQ2E6QChLaWchTk9YST9FOikmVW48aXVMcnNtWG08SnMyW25POCdlJ0tgSThfcThDWjM6bmxwcU8ncllrTSlSLE5CZmIqXGE9czdeJzYqWUI9OGptSW5JRCg4NyhkJmJAajhGNE4mZTBIV1YvNkYxWGhCIS9VcGM6RFtXVCFOb29hLlomUWBKZEQ4OVJxKlFYa0sjJWFNMGZraWNmI0AhZmIpciZSN2ZPISVRIUNwVilEYURrMEpzb1hYJ1pDJVVrLVwlJjwzZ1gvPSw6WCxAZS4iRV4tamklbl5uLyhHLDVhTTRabTZfUE1gLyRXKWl+PmVuZHN0cmVhbQplbmRvYmoKMjQgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggNzc3Cj4+CnN0cmVhbQpHYXRuIkRibytBJkI8VyU7ciNRNilJRGgvaz9XWTUrZ0o7O0hpXUdATlBWbFBqJiJqbG4hcGI9IVpkX18rc2tYaTU2KCZCazoiUkRUdTRMQCFSPmBcSVMjKUdhQihWbyZqaCRWTWdZKFRVImMsWDY1VXVTUiYicyxqK1BFZGJSdSRUVWJtcXViRyRabV06TkNfXGtjKkZZOygvIjFgOTJoNTRTOVNRLmthaS0iLFQ8X1IzX25eUERgZl5bVmd1WUFUPytmbSlpO1BwSDwoU3MqZls/aVhYV0xeJyhIMG9eLT4/R1xRIVolMVJ0XjAmN2tpciIsOlNFRXM0XllqTFJdXCVlLCoxZi4sKkJlVHNNJUQ8PyZxbnFzIUZcOjRaTEE8LzBaJk8qNGdRbC8mbXJiOkclbHFaSF0hSGAsN29oJCtiRnMpVWBpJlkpVDxSbFVyWC5cZUxXJnAjU0tHY0lvZiJEOnEldDUyNy0rOE5SVl90U0hIMiI8c11HR1lcVHFqKmg6UmVcMVJkczJTYyF1W2NaOUtiRGY/QFRCZ1NKbHU5Ji5HXEsoSixdY3UvRmxkb041Qzs9WlgsTj1II0olPWFlNEVMPVZRRzJZNCk5T0dvRjgwSTZjPC4nS19Zb19RcC8qZT5XWikpLERDQ1U8ZztcJkRNdGdtTHRlWnIxXEBKRzZEPm1dSDBwUCwmI1hCX1Y8WTtkRWlqLUk2SyNjKzd0Qlc1TE5SaztXOF00ckdQa0xiaiMyRToyTFspVWgtLTxZI1ZSL09LY0RETTJBVlFwSUNpUyMzXC9xODJnNkwzKUIvI3AwODNiXW0lZVVJLXNkMW8nOlM+YWFUP185PVMnSl03aUknPmtFYVcvRzcobl8vKyxqYiM0al5ERkRKZ3BDUmwpQmYwIWBRZDtbXlQ2R18qa08ydEpuUkgxaUInV1FPViUjYV4zM1o/TmM9UEg9NyNGcjhzJjwoclIuVDlqV1hmOzdFV2JtVHA2YiwkRzJpXllOMjMsYllaPSo1Pixea0pkfj5lbmRzdHJlYW0KZW5kb2JqCjI1IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDEwMDEKPj4Kc3RyZWFtCkdhczFfOW9tYVcmQUBnPmJdLHF1KXInbSE3Zy1GKl8jWUkyJF5ac2RYZUNSZmByWWtqMVxwSConMy9scm8+XWhSZj8kXTcsbCIoaERjJFNLYWwqL0whYklINko+T1RHbG0nMGQyU1YubExtM2NOOmwtRzkoU0lCc1c/a0ouQk0sN2VHXCYnViY8N15SN0FvYmxaNF4pV1RXMVllZ1ZlPGhhaGxAJ1tfXU9iImBKY2VtSVA6Si9FRmNHKWRZZiciMSI5XHJoJmBQJWdUKixgLj8qImtuRkQ5PChJK0VCdVU+Vk5zK2M/VWQxLSgiUkFUQDJMM3JlbDNKM2AiR2o0Zmkkc09SWGdVWyYmWUA5bkpcRSRQKzVwVyE1aUAnLG1uYG9uajpGR2JsVXI3OCQkRkhGMihqcjgmXWw1SEFXWFtSYWkqKFVgSW41IyZ0cS9iVS9SPjU6O2RKVSheWzIiNylHN2QmMWVmLUROWlZOSiVrZGIjK0NBRDcoRC4pWXBGKTtVKlxVLmMvJjBzOlQvL1FLdFg0KSghXDVVUCo0KGo1NUFxOjF0PGpDXFg1YWpBZ3NjbTZvKiRNZCclVkI0LVdaMkZDT2xCZWwvbWQuV2VtRDxzMFJyPjZtKkYocDJyQT5vbW9TVkclU3FrZ2ZbRWpyWFdsKzJrYk02Oz5yXSdQQ2UtckhAWFhKPl4mWm07IjhTaG1TLEROUGskMj8uRD5JXlZdOE4kZDlWck9bblQ4SEtrR2FBRFo1SzAjVGVna1VPbUpwb0NwY2xhVSpcTFw3czE5QW9fP11WW19JK1pSKWhdSUhaP1RRXF9SY110VkpwaGdUYCssQWlkTWtCRC4+RzxvPGcvWytPakBkQGxpMTRpMUdWQGhaaD9nWkNScnMxbkU2R2BvRi9AWDVbNFE3TVwjcksiWGZHYnFpUUc5JGtpJ3FYaT1MQUM6RFE8KEZoT21fWSctbDpSPEExZ2lELiRTXENZVTltXEYnQWJwcCwtXEVAaGNNYS0ub2ErZ08kSWBbZ1FObjpZTyglQz0pSy5IcVslQ2RCXTBVY1ksRmwkWUwtSTcoXSomUE1rPFwkKFJkMl1qIVQiSmBzPz5UTTYoWDpnWyZpdWlWWFhRLWZDJzZTNSMxUTJAW2pIVlFBY1ItbSMjWy9XU01eTHFncTosWSI0TThdaEFVcGpbZyc/NVZaSGQ1OGUyWXNtaDpAKWUtOVJZSWQiLSpsbEkpNm8jdW0kRGJPUVwsdHUvY10xLVZqR0RhR2Y0cGRpZGptJVoyaGpAQT5PNkg7aVUnLipLWjF0ZlNbaVwoIUQjT0xzaVldOX4+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMjYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMzIgMDAwMDAgbiAKMDAwMDAwMDIzOSAwMDAwMCBuIAowMDAwMDAwMzUxIDAwMDAwIG4gCjAwMDAwMDA0NTkgMDAwMDAgbiAKMDAwMDAwMDU2OSAwMDAwMCBuIAowMDAwMDAwNzY0IDAwMDAwIG4gCjAwMDAwMDA4NzMgMDAwMDAgbiAKMDAwMDAwMTA2OCAwMDAwMCBuIAowMDAwMDAxMjYzIDAwMDAwIG4gCjAwMDAwMDE0NTkgMDAwMDAgbiAKMDAwMDAwMTY1NSAwMDAwMCBuIAowMDAwMDAxODUxIDAwMDAwIG4gCjAwMDAwMDIwNDcgMDAwMDAgbiAKMDAwMDAwMjI0MyAwMDAwMCBuIAowMDAwMDAyMzEzIDAwMDAwIG4gCjAwMDAwMDI2MjMgMDAwMDAgbiAKMDAwMDAwMjczMCAwMDAwMCBuIAowMDAwMDAzMzg1IDAwMDAwIG4gCjAwMDAwMDQ4NzMgMDAwMDAgbiAKMDAwMDAwNTkzMCAwMDAwMCBuIAowMDAwMDA2OTUxIDAwMDAwIG4gCjAwMDAwMDc4NDEgMDAwMDAgbiAKMDAwMDAwODcyNyAwMDAwMCBuIAowMDAwMDA5NTk1IDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPDI1MzY4NGFlNWFhZTlmNGUwZThkMWRjNTM3YmY1ODkwPjwyNTM2ODRhZTVhYWU5ZjRlMGU4ZDFkYzUzN2JmNTg5MD5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gMTYgMCBSCi9Sb290IDE1IDAgUgovU2l6ZSAyNgo+PgpzdGFydHhyZWYKMTA2ODgKJSVFT0YK';

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(origin) {
  const headers = { Vary: 'Origin' };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function gateForPaymentLinkUrl(linkUrl) {
  for (const [gate, url] of Object.entries(GATE_PAYMENT_LINKS)) {
    if (url === linkUrl) return gate;
  }
  return null;
}

async function addToMailerLiteGroup(env, email, groupId) {
  if (!env.MAILERLITE_API_KEY) return;
  await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Bearer ' + env.MAILERLITE_API_KEY,
    },
    body: JSON.stringify({ email, groups: [groupId] }),
  });
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function handleSecretPlaceDownload(request, env, origin) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(origin),
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'GET') {
    return json({ verified: false, error: 'method_not_allowed' }, 405, origin);
  }

  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
    return json({ verified: false, error: 'invalid_session_id' }, 400, origin);
  }

  if (!env.STRIPE_SECRET_KEY) {
    return json({ verified: false, error: 'not_configured' }, 503, origin);
  }

  let session;
  try {
    const stripeRes = await fetch(
      `${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_link`,
      { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
    );
    if (!stripeRes.ok) {
      return json({ verified: false, error: 'session_not_found' }, 404, origin);
    }
    session = await stripeRes.json();
  } catch (err) {
    return json({ verified: false, error: 'stripe_request_failed' }, 502, origin);
  }

  const paid = session.payment_status === 'paid' && session.status === 'complete';
  const paymentLinkUrl =
    session.payment_link && typeof session.payment_link === 'object' ? session.payment_link.url : null;

  if (!paid || paymentLinkUrl !== SECRET_PLACE_PAYMENT_LINK) {
    return json({ verified: false, error: 'not_paid' }, 402, origin);
  }

  const buyerEmail = session.customer_details && session.customer_details.email;
  if (buyerEmail) {
    try {
      await addToMailerLiteGroup(env, buyerEmail, SECRET_PLACE_MAILERLITE_GROUP);
    } catch (err) {
      // swallow - unlocking the purchased content matters more than this
    }
  }

  const pdfBytes = base64ToUint8Array(SECRET_PLACE_PDF_BASE64);
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${SECRET_PLACE_PDF_FILENAME}"`,
      ...corsHeaders(origin),
    },
  });
}

async function handleVerifyPurchase(request, env, origin) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(origin),
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'GET') {
    return json({ verified: false, error: 'method_not_allowed' }, 405, origin);
  }

  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
    return json({ verified: false, error: 'invalid_session_id' }, 400, origin);
  }

  if (!env.STRIPE_SECRET_KEY) {
    return json({ verified: false, error: 'not_configured' }, 503, origin);
  }

  let session;
  try {
    const stripeRes = await fetch(
      `${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_link`,
      { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
    );
    if (!stripeRes.ok) {
      return json({ verified: false, error: 'session_not_found' }, 404, origin);
    }
    session = await stripeRes.json();
  } catch (err) {
    return json({ verified: false, error: 'stripe_request_failed' }, 502, origin);
  }

  const paid = session.payment_status === 'paid' && session.status === 'complete';
  const paymentLinkUrl =
    session.payment_link && typeof session.payment_link === 'object' ? session.payment_link.url : null;
  const gate = paymentLinkUrl ? gateForPaymentLinkUrl(paymentLinkUrl) : null;

  if (!paid) {
    return json({ verified: false, error: 'not_paid' }, 402, origin);
  }
  if (!gate) {
    return json({ verified: false, error: 'unknown_gate' }, 402, origin);
  }

  const buyerEmail = session.customer_details && session.customer_details.email;
  const groupId = GATE_MAILERLITE_GROUPS[gate];
  if (buyerEmail && groupId) {
    // Joining this group is what fires that gate's welcome sequence in
    // MailerLite. Fire-and-forget: a MailerLite hiccup shouldn't block the
    // buyer from seeing the toolkit they already paid for.
    try {
      await addToMailerLiteGroup(env, buyerEmail, groupId);
    } catch (err) {
      // swallow - unlocking the purchased content matters more than this
    }
  }

  return json(
    {
      verified: true,
      gate,
      sessionId: session.id,
      amountTotal: session.amount_total,
      currency: session.currency,
    },
    200,
    origin
  );
}

async function emailInMailerLiteGroup(env, email, groupId) {
  const target = email.trim().toLowerCase();
  let url = `https://connect.mailerlite.com/api/groups/${groupId}/subscribers?limit=100`;
  for (let page = 0; page < 20 && url; page++) {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + env.MAILERLITE_API_KEY },
    });
    if (!res.ok) return false;
    const body = await res.json();
    const hit = (body.data || []).some((s) => s.email && s.email.toLowerCase() === target);
    if (hit) return true;
    url = body.links && body.links.next ? body.links.next : null;
  }
  return false;
}

// Lets a buyer on a new device/browser recover which gates they've already
// paid for, by email, with no password or account system: scans each gate's
// MailerLite buyer group (joined by /verify-purchase on a confirmed Stripe
// purchase) for the given email.
async function handleRestoreAccess(request, env, origin) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(origin),
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, origin);

  const email = new URL(request.url).searchParams.get('email');
  if (!email || !EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 400, origin);
  if (!env.MAILERLITE_API_KEY) return json({ error: 'not_configured' }, 503, origin);

  const unlockedGates = [];
  for (const gate of Object.keys(GATE_MAILERLITE_GROUPS)) {
    try {
      if (await emailInMailerLiteGroup(env, email, GATE_MAILERLITE_GROUPS[gate])) unlockedGates.push(gate);
    } catch (err) {}
  }
  return json({ unlockedGates }, 200, origin);
}

async function handleMailerliteSubscribe(request, env, origin) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(origin),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const MAILERLITE_GROUPS = {
    A: '196101704591083355',
    B: '196101706647340497',
    C: '196101708750783558',
    D: '196101710880441776',
    NB: '196101713496639044',
    gate0: '194025314623424492',
    secretplace: '192667224052336080',
    namesofgod: '198005637470225771',
  };

  const { email, name, groupKey } = await request.json();
  const groupId = MAILERLITE_GROUPS[groupKey];
  if (!email || !groupId) {
    return new Response('Bad request', { status: 400, headers: corsHeaders(origin) });
  }
  await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Bearer ' + env.MAILERLITE_API_KEY,
    },
    body: JSON.stringify({ email, fields: { name: name || '' }, groups: [groupId] }),
  });
  return new Response('OK', { status: 200, headers: corsHeaders(origin) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (url.pathname === '/mailerlite-subscribe' && (request.method === 'POST' || request.method === 'OPTIONS')) {
      return handleMailerliteSubscribe(request, env, origin);
    }

    if (url.pathname === '/verify-purchase') {
      return handleVerifyPurchase(request, env, origin);
    }

    if (url.pathname === '/secret-place/download') {
      return handleSecretPlaceDownload(request, env, origin);
    }

    if (url.pathname === '/restore-access') {
      return handleRestoreAccess(request, env, origin);
    }

    return new Response('Not found', { status: 404 });
  },
};
