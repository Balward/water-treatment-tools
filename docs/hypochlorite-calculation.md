# Filter Basin Hypochlorite Calculation

Reviewed October 22, 2026. This app calculates solution needed for an applied chlorine-equivalent dose in a fixed water volume. It does not predict the resulting residual, chlorine demand, decay, breakpoint behavior, or disinfection contact time.

## Mass Balance

All calculations retain full floating-point precision until display.

- Water liters = basin US gallons × 3.785411784.
- Required available chlorine grams (as Cl2) = dose mg/L × water liters / 1,000.
- For NaOCl weight %, product chlorine g/L = (percent / 100) × SG × 1,000 × (70.906 / 74.442).
- For available chlorine weight %, product chlorine g/L = (percent / 100) × SG × 1,000.
- For trade %, product chlorine g/L = percent × 10.
- Solution liters = required chlorine grams / product chlorine g/L.
- Solution US gallons = solution liters / 3.785411784.
- Solution pounds = solution liters × SG × 1,000 / 453.59237.
- Available chlorine pounds = chlorine grams / 453.59237.
- US fluid ounces = solution gallons × 128; milliliters = solution liters × 1,000.

As in normal operator calculations, water reference density is approximated as 1 kg/L, so SG is numerically used as solution kg/L. The added solution's volume is neglected. This is a dilute batch-addition approximation, not a correction for large changes in total basin volume. No chemical-strength decay model is applied: use current product strength and density. SG 1.10 is an explicit starting assumption, not a validated density for every 10% product.

## Corrections To The Previous Version

- Replaced a fixed SG of 1.1 with an editable product input.
- Distinguished NaOCl mass percent from available-chlorine mass percent and trade percent; these must not be used interchangeably.
- Replaced 0.96 with the approximately 0.9525 Cl2/NaOCl molar-mass ratio when strength is NaOCl weight %. This represents chlorine equivalence, not a 96% disinfection efficiency.
- Removed the daily-rate variable interpretation from this batch calculation.
- Corrected a summary that mislabeled total solution pounds as active-chlorine pounds.
- Avoided rounding small additions to zero gallons; result values use four significant digits.
- Invalid and nonfinite inputs are rejected; changed inputs invalidate old results and worked steps.

## References

- [OxyChem Sodium Hypochlorite Handbook, terminology, printed page 5](https://halogenvalve.com/downloads/chemical-safety/hypochlorite/Hypo_Handbook_Oxy_Chem.pdf#page=5): manufacturer-authored explanation of weight percent, trade percent, and available chlorine. Its rounded example equates 5.25% NaOCl by weight with 5% available chlorine by weight. The implementation uses the molar-mass ratio rather than that rounded equivalence.
- [Oregon Health Authority operator training, Dose and Density, PDF page 6](https://www.oregon.gov/oha/PH/HEALTHYENVIRONMENTS/DRINKINGWATER/OPERATIONS/TREATMENT/Documents/swcf/CFDF-3-2024/CFDF-b-6pp.pdf#page=6): dose/volume mass balance and the use of solution density when converting chemical mass to liquid volume. The app uses a fixed basin volume rather than the training's daily-flow example.

## Validation

`scripts/check-hypochlorite-math.cjs` verifies an independently expressed US-unit balance, a known 1-gallon result, agreement between all three strength conventions for equivalent solutions, density effects, mass/volume conversions, scaling, very small additions, and invalid/overflow handling. `scripts/check-hypochlorite-ui.cjs` verifies the rendered outputs, input invalidation, worked steps, native validation, reset, keyboard submission, and shared navigation at 320–1920 px. Set `OPS_PUBLIC=1` to run the browser checks against the deployed app.

For 35,400 US gallons, a 1 mg/L addition as Cl2, 10% NaOCl by weight, and SG 1.10: solution volume is approximately 0.337867 US gallons (1,278.97 mL). Available chlorine needed is about 0.295427 lb; solution weight is about 3.10160 lb. The selected product basis and actual SG materially affect this answer.
