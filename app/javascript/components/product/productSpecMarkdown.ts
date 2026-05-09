// Pure data — no JSX, no imports. Safe for any tree.
// A long markdown spec sheet — used to make the SSR/Client variants ship more
// markdown content for the heavy markdown stack to chew through during
// hydration. The RSC variant pre-renders this to HTML server-side.

export function buildProductSpecMarkdown(productName: string, sku: string): string {
  return `## Engineering specifications

The ${productName} (${sku}) was designed for sustained use in retail and
hospitality environments. Every component is sourced through audited supplier
relationships, with full chain-of-custody documentation available on request.

### Operating environment

| Parameter            | Range                          | Notes                              |
|---------------------:|:-------------------------------|:-----------------------------------|
| Operating temp       | 0 °C – 45 °C                   | Continuous duty                    |
| Storage temp         | -20 °C – 60 °C                 | Up to 6 months                     |
| Relative humidity    | 5 % – 95 % (non-condensing)    |                                    |
| Altitude             | up to 3,000 m                  | Pressure-compensated               |
| IP rating            | IP54                           | dust + splash protection           |

### Power & connectivity

| Spec                 | Value                                |
|---------------------:|:-------------------------------------|
| Input voltage        | 100–240 VAC, 50/60 Hz                |
| Standby power draw   | < 0.5 W                              |
| Operating power      | 18 W typical, 32 W peak              |
| Network              | 802.11 a/b/g/n/ac/ax (Wi-Fi 6)       |
| Bluetooth            | 5.2, BLE                             |
| Wired                | 1 × Gigabit Ethernet, RJ-45          |
| USB                  | 2 × USB-C (PD), 1 × USB-A 3.2        |

### Reliability targets

We test against the following targets in our Vermont facility. Real-world
field data over the last three product generations matches or beats these
numbers:

- **MTBF** (mean time between failures): 60,000 hours
- **MCBF** (mean cycles between failures): 1.2 M cycles
- **Burn-in**: 72 hours at elevated temperature before shipping
- **Drop test**: passes 1 m onto vinyl flooring on all six faces

\`\`\`text
Reliability test schedule (excerpt — 8 of 23 tests shown):

  T1  Cold-start boot loop      | -10 °C → 25 °C | 500 cycles  | PASS
  T2  Hot-start boot loop       |  45 °C         | 500 cycles  | PASS
  T3  Salt-fog corrosion        |  35 °C, 5 % salt | 96 hours  | PASS
  T4  Voltage sag               | 80 %–110 %      | 2,000 events| PASS
  T7  EMC immunity              | IEC 61000-4-3   | continuous  | PASS
  T9  Surface impact            | 6 J            | 12 strikes  | PASS
  T11 Thermal cycling           | -20 → 60 °C     | 100 cycles  | PASS
  T19 Power-cycle endurance     | hot/cold mix   | 25,000 cyc  | PASS
\`\`\`

### Materials & finishes

The chassis is machined from a 6061-T6 aluminum billet, anodized in our
five-stage process. Color-matched to ISO 12646 viewing-booth conditions; we
maintain ΔE < 1.5 across batches.

\`\`\`yaml
chassis:
  material: aluminum 6061-T6
  finish: anodized type II, sulfuric
  color: matte graphite (RAL 7022)
  thickness: 3.2 mm avg
fasteners:
  type: torx T8 stainless
  thread-locker: medium-strength (Loctite 243)
seals:
  type: silicone, food-grade (FDA 21 CFR 177.2600)
  durometer: 40 ± 5 Shore A
\`\`\`

### Software & firmware

Each unit ships with our LTS firmware track (currently 4.6.x). Security
updates are pushed automatically; feature updates are opt-in via the admin
console.

\`\`\`json
{
  "firmware": {
    "track": "lts",
    "current": "4.6.12",
    "checks": ["sha256", "ed25519"],
    "rollback": "atomic, A/B partitions",
    "telemetry": "off by default; opt-in"
  }
}
\`\`\`

### Compliance

- FCC Part 15 Class B
- CE / RED 2014/53/EU
- IC RSS-247
- KCC / MIC
- RoHS 3 (EU 2015/863)
- WEEE (registered in 27 EU countries)

> Compliance documentation is available in our customer portal at
> \`compliance/${sku}.zip\` (signed manifest, individual certificates,
> independent test-lab reports). Documents are issued under the
> Open Compliance Framework v3.

### Maintenance & repair

Every component is field-replaceable in 15 minutes or less, using stocked
parts in our network of authorized service centers. We publish full repair
documentation under a Creative Commons license.

\`\`\`bash
# Diagnostic command quick-reference
$ ${sku.toLowerCase()}-tool status         # health check
$ ${sku.toLowerCase()}-tool logs --since 1h  # recent activity
$ ${sku.toLowerCase()}-tool reset --soft   # reset preserving config
$ ${sku.toLowerCase()}-tool reset --hard   # factory reset (WIPES data)
\`\`\`

### Lifecycle commitment

We commit to:

1. **5 years** of free firmware updates (security + bug-fix)
2. **7 years** of paid update support if needed past year 5
3. **10 years** of replacement-part availability (genuine parts at parity pricing)
4. **Open documentation**: schematics, board files, and repair guides published
   under CC-BY-SA at the end of the product's commercial life

We have a public end-of-life calendar at \`/lifecycle/${sku}\`.
`;
}
