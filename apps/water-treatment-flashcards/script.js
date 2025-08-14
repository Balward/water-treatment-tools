// Flashcard Data
const flashcardData = {
  'grade1': {
    title: 'Water Treatment Grade 1',
    cards: []
  },
  'grade2': {
    title: 'Water Treatment Grade 2',
    cards: []
  },
  'grade3-4': {
    title: 'Water Treatment Grades 3 & 4',
    chapters: {
      'basic-microbiology-chemistry': {
        title: 'Basic Microbiology and Chemistry',
        cards: [
          {
            term: 'Calcium Carbonate',
            definition: 'A white crystalline compound (CaCO₃) that forms the primary component of limescale deposits in water systems. In water treatment, it serves as a pH buffer and can be intentionally added to reduce water corrosiveness, while excessive amounts can cause scaling problems in pipes and equipment.'
          },
          {
            term: 'Ultraviolet (UV) Disinfection',
            definition: 'A physical disinfection process that uses UV light at 254 nanometers wavelength to destroy bacteria, viruses, and other pathogens by damaging their DNA. UV disinfection provides effective pathogen inactivation without adding chemicals to the water, but requires clear water for optimal effectiveness and provides no residual disinfection.'
          },
          {
            term: 'Membrane Filtration',
            definition: 'A pressure-driven separation process that uses semi-permeable membranes to remove contaminants from water based on size exclusion. Types include microfiltration, ultrafiltration, nanofiltration, and reverse osmosis, each removing progressively smaller particles and dissolved constituents.'
          },
          {
            term: 'Hardness',
            definition: 'The measure of dissolved calcium and magnesium ions in water, typically expressed as milligrams per liter of calcium carbonate equivalent. Hard water causes soap scum, scale formation in pipes and water heaters, and can affect the taste of water, while very soft water may be corrosive to plumbing systems.'
          },
          {
            term: 'Carbonate Hardness',
            definition: 'The portion of total hardness caused by calcium and magnesium ions associated with carbonate and bicarbonate ions, also known as temporary hardness. This type of hardness can be removed by boiling or lime softening processes, as heating converts bicarbonates to less soluble carbonates that precipitate out.'
          },
          {
            term: 'Noncarbonate Hardness',
            definition: 'The portion of total hardness caused by calcium and magnesium ions associated with sulfate, chloride, or nitrate ions, also known as permanent hardness. This hardness cannot be removed by boiling and requires chemical treatment methods such as ion exchange or lime-soda ash softening for removal.'
          },
          {
            term: 'Recarbonation',
            definition: 'The process of adding carbon dioxide gas to water after lime softening treatment to lower pH and stabilize the water. This process converts excess lime to calcium carbonate and bicarbonate, preventing post-treatment precipitation and reducing the corrosiveness of the treated water to distribution system materials.'
          },
          {
            term: 'Ion Exchange Process',
            definition: 'A water treatment method that removes unwanted ions from water by exchanging them with more desirable ions attached to a resin material. Commonly used for water softening by exchanging calcium and magnesium ions with sodium ions, or for removing specific contaminants like nitrates or heavy metals.'
          },
          {
            term: 'Regeneration',
            definition: 'The process of restoring an ion exchange resin to its original ionic form after it becomes saturated with removed ions. Typically involves backwashing the resin bed and then passing a concentrated solution of the desired replacement ions through the resin to recharge it for continued use.'
          },
          {
            term: 'Langelier Saturation Index',
            definition: 'A calculated value that predicts the tendency of water to precipitate or dissolve calcium carbonate, indicating whether water is corrosive or scale-forming. A negative LSI indicates corrosive water that will dissolve pipes and fixtures, while a positive LSI indicates water that will form protective scale deposits.'
          },
          {
            term: 'Saturation',
            definition: 'The condition where water contains the maximum amount of a dissolved substance it can hold at a given temperature and pressure. In water treatment, saturation is important for understanding when precipitation or crystallization will occur, particularly with minerals like calcium carbonate that affect water stability.'
          },
          {
            term: 'Chelation',
            definition: 'A chemical process where organic compounds called chelating agents bind to metal ions, forming stable ring-like molecular structures that keep metals in solution. In water treatment, chelation is used to prevent metal precipitation, control scale formation, and sequester iron and manganese to prevent staining and taste problems.'
          },
          {
            term: 'Sequestration',
            definition: 'The process of chemically binding metal ions in solution to prevent them from participating in unwanted reactions such as oxidation or precipitation. Sequestering agents keep metals like iron, manganese, and calcium in solution, preventing staining, scaling, and catalytic effects that could degrade water quality or treatment chemicals.'
          }
        ]
      },
      'advanced-math-operators': {
        title: 'Advanced Math for Operators',
        cards: [
          {
            term: 'Head',
            definition: 'A measure of the energy per unit weight of water, expressed as the height of a column of water that the energy could lift. In water treatment systems, head represents the pressure energy available to move water through pipes, pumps, and treatment processes, typically measured in feet of water column.'
          },
          {
            term: 'Pounds per Square Inch Gauge (PSIG)',
            definition: 'A unit of pressure measurement that indicates pressure above atmospheric pressure, commonly used in water treatment systems to measure pump discharge pressures and system operating pressures. PSIG readings are relative to atmospheric pressure, with 0 PSIG being equal to atmospheric pressure (14.7 psia at sea level).'
          },
          {
            term: 'Pressure Head',
            definition: 'The height of a column of water that would produce the same pressure as measured at a given point in the system, calculated by dividing pressure by the specific weight of water. In water treatment, pressure head helps determine the energy available to push water through filters, pipes, and other system components.'
          },
          {
            term: 'Hydraulic Grade Line (HGL)',
            definition: 'A graphical representation showing the total energy available at any point in a water system, plotted as the sum of elevation head and pressure head. The HGL slopes downward in the direction of flow due to friction losses and helps operators understand energy distribution throughout the treatment and distribution system.'
          },
          {
            term: 'Elevation Head',
            definition: 'The potential energy component of total head, representing the height of water above a reference datum or elevation. In water treatment facilities, elevation head determines the energy needed to lift water to storage tanks or the energy available from elevated sources like reservoirs.'
          },
          {
            term: 'Velocity Head',
            definition: 'The kinetic energy component of total head, representing the energy due to water motion, calculated as the velocity squared divided by twice the acceleration due to gravity. Velocity head is typically small in water treatment systems but becomes significant in high-velocity applications like pump discharge lines.'
          },
          {
            term: 'Energy Grade Line (EGL)',
            definition: 'A graphical representation of the total energy in a water system at any point, plotted as the sum of elevation head, pressure head, and velocity head. The EGL always lies above the HGL by the amount of velocity head and continuously slopes downward due to energy losses from friction and turbulence.'
          },
          {
            term: 'Friction Head Loss',
            definition: 'The energy loss that occurs as water flows through pipes, valves, and fittings due to friction between the water and the pipe walls or internal turbulence. Friction head loss increases with flow rate, pipe length, and roughness, and must be overcome by pumps to maintain adequate flow and pressure in water treatment systems.'
          },
          {
            term: 'Instantaneous Flow Rate',
            definition: 'The volume of water flowing past a specific point at any given moment, typically measured in gallons per minute (GPM) or cubic feet per second (CFS). In water treatment, instantaneous flow rates are crucial for sizing equipment, calculating detention times, and ensuring proper chemical dosing rates.'
          },
          {
            term: 'Pump Centerline',
            definition: 'The horizontal reference line passing through the center of a pump impeller, used as a datum for calculating suction and discharge head measurements. The pump centerline elevation is critical for determining net positive suction head (NPSH) and proper pump installation in water treatment facilities.'
          },
          {
            term: 'Static Suction Head',
            definition: 'The vertical distance from the pump centerline down to the free surface of the water being pumped when the source is above the pump. Static suction head represents positive pressure at the pump suction and aids in preventing cavitation in water treatment pumping applications.'
          },
          {
            term: 'Static Suction Lift',
            definition: 'The vertical distance from the free surface of the water source up to the pump centerline when the source is below the pump. Static suction lift creates negative pressure at the pump suction and must be minimized to prevent cavitation and maintain reliable pump operation.'
          },
          {
            term: 'Static Discharge Head',
            definition: 'The vertical distance from the pump centerline to the free surface of the water at the discharge point, representing the elevation that the pump must overcome. Static discharge head is a major component of total system head and directly affects pump power requirements and selection.'
          },
          {
            term: 'Total Static Head',
            definition: 'The total vertical distance that a pump must overcome, calculated as the sum of static suction lift (or minus static suction head) and static discharge head. Total static head represents the minimum energy required to move water from source to destination, regardless of flow rate.'
          },
          {
            term: 'Minor Head Losses',
            definition: 'Energy losses that occur at fittings, valves, bends, expansions, and contractions in piping systems, caused by flow turbulence and direction changes. While called "minor," these losses can be significant in water treatment systems with numerous valves and fittings, and must be included in pump sizing calculations.'
          },
          {
            term: 'Dynamic Suction Head',
            definition: 'The static suction head minus the friction losses in the suction piping when water is flowing, representing the actual pressure available at the pump suction during operation. Dynamic suction head decreases as flow rate increases due to higher friction losses in the suction line.'
          },
          {
            term: 'Dynamic Suction Lift',
            definition: 'The static suction lift plus the friction losses in the suction piping when water is flowing, representing the total energy deficit that must be overcome at the pump suction. Dynamic suction lift increases with flow rate and must be carefully managed to prevent pump cavitation.'
          },
          {
            term: 'Total Dynamic Head',
            definition: 'The total energy that a pump must provide to move water through a system at a specific flow rate, including static head plus all friction losses and minor losses. Total dynamic head varies with flow rate and is the key parameter used for pump selection and performance evaluation in water treatment systems.'
          },
          {
            term: 'Horsepower',
            definition: 'A unit of power measurement equal to 550 foot-pounds per second or 746 watts, used to quantify the rate of energy transfer in pumping systems. In water treatment, horsepower calculations help determine pump efficiency, operating costs, and motor sizing requirements for various applications.'
          },
          {
            term: 'Efficiency',
            definition: 'The ratio of useful power output to total power input, expressed as a percentage, indicating how effectively energy is converted from one form to another. In water treatment pumping systems, efficiency affects operating costs and is the product of pump efficiency, motor efficiency, and drive efficiency.'
          },
          {
            term: 'Work',
            definition: 'The energy required to move an object through a distance against a force, measured in foot-pounds in the English system. In water treatment, work represents the energy needed to lift water against gravity or push it through resistance, forming the basis for power and efficiency calculations.'
          },
          {
            term: 'Power',
            definition: 'The rate at which work is performed or energy is transferred, typically measured in horsepower or watts in water treatment applications. Power requirements determine motor sizing, electrical costs, and system operating efficiency for pumps, blowers, and other mechanical equipment.'
          },
          {
            term: 'Water Horsepower',
            definition: 'The theoretical minimum power required to move water through a system, calculated from flow rate and total dynamic head without considering inefficiencies. Water horsepower represents the ideal power requirement and serves as the basis for calculating pump efficiency and actual power needs.'
          },
          {
            term: 'Brake Horsepower',
            definition: 'The actual mechanical power delivered by a motor to a pump shaft, representing the power input to the pump after accounting for motor inefficiencies. Brake horsepower is higher than water horsepower due to pump inefficiencies and is used to size motors and calculate operating costs.'
          },
          {
            term: 'Motor Horsepower',
            definition: 'The electrical power input to a motor, which must exceed brake horsepower due to motor inefficiencies that convert some electrical energy to heat. Motor horsepower determines electrical demand, circuit sizing, and energy costs for water treatment facility operations.'
          },
          {
            term: 'Wire-to-Water Efficiency',
            definition: 'The overall system efficiency from electrical input to useful water pumping output, calculated as water horsepower divided by motor horsepower and expressed as a percentage. Wire-to-water efficiency accounts for all system losses and is the key metric for evaluating pumping system performance and energy costs.'
          },
          {
            term: 'Pump Characteristic Curves',
            definition: 'Graphical representations showing the relationship between flow rate and head, efficiency, and power for a specific pump at a given speed. These curves are essential tools for pump selection, system design, and troubleshooting in water treatment facilities, helping operators understand pump performance under various conditions.'
          },
          {
            term: 'Design Point',
            definition: 'The specific combination of flow rate and head at which a pump operates most efficiently and reliably, representing the optimal match between pump characteristics and system requirements. Operating at or near the design point maximizes efficiency, minimizes energy costs, and extends equipment life in water treatment applications.'
          },
          {
            term: 'Total Hardness',
            definition: 'The sum of all calcium and magnesium ions in water, typically expressed as milligrams per liter of calcium carbonate equivalent, representing the complete measure of water hardness. Total hardness affects soap effectiveness, scale formation, corrosion potential, and taste, making it a critical parameter for water treatment process design and monitoring.'
          },
          {
            term: 'Total Alkalinity',
            definition: 'The measure of water\'s capacity to neutralize acids, primarily due to bicarbonate, carbonate, and hydroxide ions, expressed as milligrams per liter of calcium carbonate equivalent. Total alkalinity affects pH stability, corrosion control, coagulation effectiveness, and disinfection efficiency in water treatment processes.'
          }
        ]
      },
      'usepa-water-regulations': {
        title: 'USEPA Water Regulations',
        cards: [
          {
            term: 'US Environmental Protection Agency',
            definition: 'A federal agency established in 1970 responsible for protecting human health and the environment by enforcing regulations under existing environmental laws. In water treatment, EPA sets drinking water standards, regulates disinfection requirements, and oversees compliance with the Safe Drinking Water Act to ensure public water systems provide safe drinking water.'
          },
          {
            term: 'Maximum Contaminant Level Goal (MCLG)',
            definition: 'The level of a contaminant in drinking water below which there is no known or expected risk to health, allowing for an adequate margin of safety. MCLGs are non-enforceable public health goals that consider only health risks and exposure over a lifetime, including sensitive populations like children and pregnant women.'
          },
          {
            term: 'Maximum Contaminant Level (MCL)',
            definition: 'The highest level of a contaminant that is allowed in drinking water under federal regulations, set as close to the MCLG as feasible using the best available treatment technology. MCLs are legally enforceable standards that balance health protection with technical feasibility and cost considerations for water treatment systems.'
          },
          {
            term: 'Disinfection By-products (DBPs)',
            definition: 'Chemical compounds formed when disinfectants used to treat drinking water react with naturally occurring organic and inorganic matter in source water. Common DBPs include trihalomethanes (THMs) and haloacetic acids (HAAs), which are regulated due to potential long-term health risks including increased cancer risk.'
          },
          {
            term: 'Running Annual Average (RAA)',
            definition: 'A compliance calculation method for certain water quality parameters where the average of quarterly sampling results over the most recent four quarters is used to determine regulatory compliance. RAA is commonly used for disinfection by-products monitoring and helps smooth out seasonal variations in contaminant levels.'
          },
          {
            term: 'C x T Value',
            definition: 'A mathematical concept representing the product of disinfectant concentration (C) in mg/L and contact time (T) in minutes, used to quantify the effectiveness of disinfection processes. Higher C x T values indicate greater pathogen inactivation, with specific values required by regulations to achieve desired levels of virus, bacteria, and Giardia removal.'
          }
        ]
      },
      'water-quality-testing': {
        title: 'Water Quality Testing',
        cards: [
          {
            term: 'Grab Sample',
            definition: 'A single water sample collected at a specific location and time, representing water quality conditions at the moment of collection. Grab samples are used for parameters that change rapidly or when instantaneous results are needed, though they may not represent average conditions over time.'
          },
          {
            term: 'Dissolved Oxygen (DO)',
            definition: 'The amount of oxygen gas dissolved in water, typically measured in mg/L or ppm, which is essential for aquatic life and indicates water quality. DO levels are affected by temperature, pressure, salinity, and biological activity, with higher levels generally indicating better water quality and lower levels suggesting pollution or eutrophication.'
          },
          {
            term: 'Composite Sample',
            definition: 'A water sample composed of individual samples collected at regular intervals over a specific time period and combined proportionally, providing a more representative average of water quality conditions. Composite sampling is useful for parameters that vary throughout the day and helps reduce analytical costs while providing better overall data.'
          },
          {
            term: 'Chain of Custody',
            definition: 'A documented procedure that tracks the handling, transfer, and storage of water samples from collection through laboratory analysis to ensure sample integrity and legal admissibility. Chain of custody forms record who collected, transported, received, and analyzed each sample, maintaining an unbroken record of sample possession.'
          },
          {
            term: 'Coliform Bacteria',
            definition: 'A group of bacteria commonly found in soil, vegetation, and the intestines of warm-blooded animals, used as indicator organisms to detect potential contamination of water supplies. While most coliforms are harmless, their presence suggests possible contamination with disease-causing pathogens and indicates the need for further investigation.'
          },
          {
            term: 'Multiple-Tube Fermentation (MTF) Method',
            definition: 'A traditional microbiological technique for detecting and enumerating coliform bacteria in water samples using a series of test tubes containing lactose broth. The method involves presumptive, confirmed, and completed tests to progressively identify and quantify coliform bacteria, providing a Most Probable Number (MPN) result.'
          },
          {
            term: 'Presumptive Test',
            definition: 'The first step in the multiple-tube fermentation method where water samples are inoculated into lactose broth tubes and incubated to detect gas production, indicating possible coliform presence. Positive presumptive tests show gas formation and turbidity, while negative tests show no gas production or growth.'
          },
          {
            term: 'Positive Sample or Presence',
            definition: 'A test result indicating the detection of the target organism or substance being analyzed, such as coliform bacteria in water quality testing. Positive results require further investigation, confirmation testing, or immediate corrective action depending on the parameter and regulatory requirements.'
          },
          {
            term: 'Negative Sample or Absence',
            definition: 'A test result indicating that the target organism or substance was not detected in the water sample at the detection limit of the analytical method. Negative results suggest the absence of contamination for the specific parameter tested, though they do not guarantee overall water safety.'
          },
          {
            term: 'Confirmed Test',
            definition: 'The second step in the multiple-tube fermentation method where positive presumptive tubes are transferred to selective media to confirm the presence of coliform bacteria. This test helps eliminate false positives from other gas-producing bacteria and provides more reliable identification of true coliforms.'
          },
          {
            term: 'Completed Test',
            definition: 'The final step in the multiple-tube fermentation method where confirmed positive samples are further tested on additional media to verify the presence of typical coliform bacteria. This test provides the highest level of confidence in coliform identification by confirming gram-negative, non-spore forming characteristics.'
          },
          {
            term: 'Presence-Absence (P-A) Method',
            definition: 'A simplified microbiological test that determines whether coliform bacteria are present or absent in a 100 mL water sample, without providing quantitative enumeration. The P-A method is faster and less expensive than MPN methods, making it suitable for routine monitoring of treated water where any coliform presence is unacceptable.'
          },
          {
            term: 'MMO-MUG Method',
            definition: 'A rapid microbiological technique using enzyme substrates methylumbelliferyl-β-D-galactopyranoside (MUG) and methylumbelliferyl-β-D-glucuronide (MMO) to simultaneously detect total coliforms and E. coli. This fluorogenic method provides results in 18-24 hours and can differentiate between total coliforms and the more specific indicator E. coli.'
          },
          {
            term: 'Membrane Filter Method',
            definition: 'A microbiological technique where water samples are filtered through a sterile membrane with 0.45 μm pores to capture bacteria, which are then cultured on selective media to identify and count specific organisms. This method provides direct colony counts and is widely used for coliform analysis and other bacterial indicators.'
          },
          {
            term: 'Heterotrophic Plate Count (HPC)',
            definition: 'A general measure of bacterial populations in water that grow on nutrient agar under aerobic conditions, providing an indication of overall microbial water quality. While HPC bacteria are generally not pathogenic, elevated counts may indicate biofilm growth, treatment inefficiency, or distribution system problems.'
          },
          {
            term: 'Acidity',
            definition: 'The capacity of water to neutralize bases, primarily due to the presence of hydrogen ions, carbonic acid, and other weak acids, measured by titration with standard base to a specific pH endpoint. Acidity affects corrosion potential, treatment chemical requirements, and can indicate industrial pollution or acid mine drainage.'
          },
          {
            term: 'Alkalinity',
            definition: 'The capacity of water to neutralize acids, primarily due to bicarbonate, carbonate, and hydroxide ions, measured by titration with standard acid to specific pH endpoints. Alkalinity provides buffering capacity against pH changes, affects coagulation efficiency, and influences corrosion control in distribution systems.'
          },
          {
            term: 'Color',
            definition: 'The visual appearance of water that results from dissolved and suspended substances, measured in color units and affecting aesthetic acceptability of drinking water. Color can indicate the presence of organic matter, industrial discharges, or treatment inefficiencies, with standards typically limiting color to 15 color units.'
          },
          {
            term: 'True Color',
            definition: 'The color of water after removal of suspended matter through filtration, representing only the color contribution from dissolved substances. True color is typically caused by dissolved organic compounds like humic and fulvic acids from natural decomposition of vegetation and is the standard measurement for regulatory compliance.'
          },
          {
            term: 'Apparent Color',
            definition: 'The color of water including both dissolved and suspended substances, representing the total visual appearance as seen by consumers. Apparent color includes contributions from turbidity and suspended particles in addition to true color, often appearing more intense than true color measurements.'
          },
          {
            term: 'Platinum-Cobalt Method',
            definition: 'A standardized colorimetric method for measuring water color using platinum-cobalt standards, where color intensity is compared to prepared solutions containing specific concentrations of chloroplatinic acid and cobalt chloride. This method provides reproducible color measurements expressed in Platinum-Cobalt Units (PCU) or Hazen Units.'
          },
          {
            term: 'Threshold Odor Number (TON)',
            definition: 'A quantitative measure of water odor intensity, defined as the dilution ratio at which odor becomes just detectable to human senses. TON testing involves successive dilutions of the sample with odor-free water until the odor threshold is reached, providing an objective measurement of subjective odor perception.'
          },
          {
            term: 'Turbidity',
            definition: 'A measure of water clarity that quantifies the scattering of light by suspended particles, measured in Nephelometric Turbidity Units (NTU) using standardized instruments. Turbidity indicates filtration effectiveness, potential for microbial contamination, and aesthetic water quality, with drinking water standards typically requiring less than 1 NTU.'
          },
          {
            term: 'Nephelometer',
            definition: 'An optical instrument that measures turbidity by detecting the intensity of light scattered at a 90-degree angle from an incident light beam passing through a water sample. Nephelometers provide precise, standardized turbidity measurements and are required for regulatory compliance monitoring in water treatment facilities.'
          },
          {
            term: 'Nomographic Method',
            definition: 'A mathematical technique using graphical charts or nomographs to solve complex calculations in water treatment, such as determining chemical dosages, contact times, or design parameters. Nomographic methods provide quick solutions to multi-variable problems without requiring detailed calculations or computer software.'
          },
          {
            term: 'Titrimetric Method',
            definition: 'An analytical technique that determines the concentration of a substance by measuring the volume of a standard solution required to react completely with the analyte. Titrimetric methods are widely used in water testing for parameters like alkalinity, hardness, chlorine residual, and dissolved oxygen analysis.'
          },
          {
            term: 'Combined Chlorine Residual',
            definition: 'Chlorine that has reacted with ammonia or organic nitrogen compounds to form chloramines, which provide longer-lasting but weaker disinfection compared to free chlorine. Combined chlorine residuals are measured to monitor chloramine formation, evaluate disinfection effectiveness, and control taste and odor problems in distribution systems.'
          },
          {
            term: 'Breakpoint',
            definition: 'The point in chlorination where chlorine demand has been satisfied and free chlorine residual begins to appear, typically occurring after combined chlorine residuals reach maximum levels and then decline. The breakpoint represents complete oxidation of ammonia and organic matter, marking the transition to effective disinfection conditions.'
          },
          {
            term: 'Breakpoint Chlorination',
            definition: 'A disinfection strategy that applies chlorine beyond the breakpoint to achieve free chlorine residuals, ensuring maximum disinfection effectiveness and minimizing taste and odor problems. This process destroys ammonia and organic compounds that interfere with disinfection while establishing stable free chlorine residuals for distribution system protection.'
          },
          {
            term: 'Chlorine Demand',
            definition: 'The amount of chlorine consumed by organic matter, ammonia, and other reducing substances in water before establishing a measurable chlorine residual. Chlorine demand must be satisfied before effective disinfection can occur, and it varies with water quality, temperature, contact time, and the presence of interfering substances.'
          },
          {
            term: 'Electrode Method',
            definition: 'An analytical technique using ion-selective electrodes or other electrochemical sensors to measure specific parameters in water, such as pH, dissolved oxygen, or chlorine residuals. Electrode methods provide rapid, continuous measurements and are commonly used for process control and online monitoring in water treatment facilities.'
          },
          {
            term: 'Modified Winkler Method',
            definition: 'A classic titrimetric procedure for measuring dissolved oxygen in water samples, involving the addition of manganese sulfate and alkaline iodide to fix oxygen, followed by acidification and titration with sodium thiosulfate. This method provides accurate DO measurements and serves as a reference standard for calibrating other DO measurement techniques.'
          },
          {
            term: 'SPADNS Method',
            definition: 'A colorimetric analytical method for measuring fluoride concentrations in water using SPADNS (sodium 2-(parasulfophenylazo)-1,8-dihydroxy-3,6-naphthalene disulfonate) reagent. The method involves adding SPADNS and zirconium chloride to form a colored complex, with fluoride concentration determined by measuring color intensity changes.'
          },
          {
            term: 'Atomic Absorption Spectrophotometer (AA)',
            definition: 'An analytical instrument that measures the concentration of metallic elements by analyzing the absorption of specific wavelengths of light by atoms in a flame or furnace. AA spectrophotometry provides precise measurements of trace metals in water samples and is essential for monitoring heavy metal contamination and treatment effectiveness.'
          },
          {
            term: 'pH',
            definition: 'A logarithmic scale from 0 to 14 that measures the hydrogen ion concentration in water, indicating acidity (pH < 7), neutrality (pH = 7), or alkalinity (pH > 7). pH affects chemical reactions, disinfection efficiency, corrosion rates, and treatment processes, making it a fundamental parameter in water quality management.'
          },
          {
            term: 'Total Organic Carbon (TOC)',
            definition: 'The amount of carbon bound in organic compounds present in water, measured in mg/L and used as an indicator of organic pollution and treatment effectiveness. TOC analysis helps evaluate the potential for disinfection by-product formation, assess biological treatment efficiency, and monitor overall organic water quality.'
          },
          {
            term: 'Gas Chromatography (GC)',
            definition: 'An analytical separation technique that identifies and quantifies volatile organic compounds by separating them based on their interaction with a stationary phase in a heated column. GC analysis is essential for detecting pesticides, industrial solvents, and other organic contaminants in water samples at very low concentrations.'
          },
          {
            term: 'Jar Test',
            definition: 'A laboratory simulation of the coagulation and flocculation process using multiple beakers (jars) to optimize chemical dosages and treatment conditions. Jar tests help determine the most effective coagulant type and dose, pH adjustment requirements, and mixing conditions for achieving desired turbidity removal and water quality goals.'
          }
        ]
      },
      'corrosion-control': {
        title: 'Corrosion Control',
        cards: [
          {
            term: 'Stabilization',
            definition: 'The process of adjusting water chemistry to achieve a balance between corrosive and scale-forming tendencies, typically by controlling pH, alkalinity, and hardness levels. Stabilized water neither causes excessive corrosion of pipes and fixtures nor deposits harmful scale, protecting both the distribution system and maintaining water quality.'
          },
          {
            term: 'Corrosion',
            definition: 'The gradual deterioration of metal pipes, fixtures, and equipment due to electrochemical reactions with water and dissolved substances. Corrosion can release harmful metals into drinking water, weaken infrastructure, cause leaks, and create taste and odor problems, making its control essential for safe water distribution.'
          },
          {
            term: 'Scaling',
            definition: 'The precipitation and accumulation of mineral deposits, primarily calcium carbonate, on the interior surfaces of pipes, heat exchangers, and equipment. Scaling reduces water flow, increases energy costs, provides sites for bacterial growth, and can interfere with disinfection and other treatment processes.'
          },
          {
            term: 'Tubercles',
            definition: 'Localized, mound-like corrosion products that form on the interior surfaces of iron and steel pipes, typically containing iron oxides and other corrosion byproducts. Tubercles create rough surfaces that increase friction losses, reduce carrying capacity, and can harbor bacteria while providing sites for continued corrosion.'
          },
          {
            term: 'Iron Bacteria',
            definition: 'Naturally occurring bacteria that obtain energy by oxidizing dissolved iron or manganese in water, forming characteristic rust-colored, slimy deposits. Iron bacteria can cause taste, odor, and discoloration problems, promote tubercle formation, and accelerate pipe corrosion in distribution systems.'
          },
          {
            term: 'Rust',
            definition: 'The reddish-brown iron oxide corrosion product that forms when iron or steel is exposed to water and oxygen over time. Rust formation indicates active corrosion processes, can cause discoloration of water, and contributes to the deterioration of iron-based distribution system components.'
          },
          {
            term: 'Corrosive or Aggressive',
            definition: 'Water characteristics that promote the dissolution or deterioration of materials in contact with the water, typically characterized by low pH, low alkalinity, high dissolved oxygen, or specific ion concentrations. Corrosive water can leach metals from pipes, reduce system lifespan, and create health concerns from elevated metal concentrations.'
          },
          {
            term: 'Concentration Cell Corrosion',
            definition: 'A type of localized corrosion that occurs when different concentrations of dissolved substances create electrical potential differences along a metal surface. This electrochemical process can cause pitting and accelerated corrosion in areas with varying oxygen, salt, or other dissolved constituent concentrations.'
          },
          {
            term: 'Galvanic Series',
            definition: 'A ranking of metals and alloys according to their tendency to corrode when in electrical contact with each other in an electrolytic environment like water. The galvanic series helps predict which metals will act as anodes (corrode) and which will act as cathodes (be protected) in galvanic corrosion situations.'
          },
          {
            term: 'Galvanic Corrosion',
            definition: 'Accelerated corrosion that occurs when two dissimilar metals are in electrical contact while immersed in an electrolytic solution like water. The more active (anodic) metal corrodes faster than it would alone, while the more noble (cathodic) metal is protected, making proper material selection and isolation crucial in system design.'
          },
          {
            term: 'Saturation Point',
            definition: 'The maximum concentration of a dissolved substance that water can hold at a given temperature and pressure before precipitation begins. Understanding saturation points helps predict scale formation potential and optimize chemical treatment dosages for corrosion control and water conditioning processes.'
          },
          {
            term: 'Quicklime',
            definition: 'Calcium oxide (CaO), a white, caustic alkaline substance produced by heating limestone, used in water treatment for pH adjustment, softening, and stabilization. Quicklime reacts vigorously with water to form slaked lime, releasing significant heat and requiring careful handling and safety precautions during storage and application.'
          },
          {
            term: 'Slurry',
            definition: 'A mixture of water and finely divided solid particles, such as lime or other treatment chemicals, that can be pumped and mixed into water systems. Slurries provide a convenient method for feeding solid chemicals, allowing for better mixing and controlled dosing while maintaining chemical reactivity and effectiveness.'
          },
          {
            term: 'Milk of Lime',
            definition: 'A dilute suspension of slaked lime (calcium hydroxide) in water, appearing as a milky white liquid used for pH adjustment and water softening. Milk of lime provides alkalinity to neutralize acidic water, precipitate hardness-causing minerals, and stabilize water chemistry for corrosion control.'
          },
          {
            term: 'Coupon Test',
            definition: 'A corrosion monitoring method involving the placement of small metal specimens (coupons) in water systems to measure corrosion rates under actual operating conditions. Coupon tests provide quantitative data on metal loss rates, help evaluate corrosion control effectiveness, and guide material selection and treatment optimization decisions.'
          }
        ]
      },
      'lime-softening': {
        title: 'Lime Softening',
        cards: [
          {
            term: 'Lime-Soda Ash Method',
            definition: 'A water softening process that uses lime (calcium hydroxide) and soda ash (sodium carbonate) to precipitate calcium and magnesium hardness as insoluble compounds. This chemical precipitation method effectively removes both carbonate and noncarbonate hardness, producing soft water while also providing some clarification and pH adjustment benefits.'
          },
          {
            term: 'Slaker',
            definition: 'A mechanical device used to convert quicklime (calcium oxide) into slaked lime (calcium hydroxide) by controlled addition of water. Slakers ensure proper hydration, control the exothermic reaction temperature, and produce a consistent lime slurry for use in water treatment processes while managing the safety hazards associated with lime handling.'
          },
          {
            term: 'Slake',
            definition: 'The chemical process of adding water to quicklime (CaO) to produce slaked lime or hydrated lime (Ca(OH)₂), releasing significant heat in an exothermic reaction. Proper slaking requires controlled water addition and mixing to ensure complete hydration and prevent dangerous temperature spikes or dust generation.'
          },
          {
            term: 'Rapid or Flash Mixing',
            definition: 'The initial high-intensity mixing stage in water treatment that provides immediate and uniform distribution of chemicals throughout the water. Flash mixing typically lasts 30 seconds to 2 minutes with high velocity gradients to ensure proper chemical dispersion and initiate coagulation reactions before flocculation begins.'
          },
          {
            term: 'Flocculation',
            definition: 'The gentle mixing process following coagulation that promotes the formation of larger, settleable particles (floc) from smaller precipitates and suspended matter. Flocculation uses slow, controlled mixing to allow particle collisions and agglomeration while avoiding floc breakup, preparing particles for effective sedimentation removal.'
          },
          {
            term: 'Sedimentation',
            definition: 'The gravitational settling process where suspended particles, floc, and precipitates settle to the bottom of a basin due to their greater density than water. Sedimentation is a primary clarification method that removes the majority of suspended solids and chemical precipitates formed during coagulation and softening processes.'
          },
          {
            term: 'Sedimentation Basin',
            definition: 'A large tank or basin designed to provide sufficient detention time and quiescent conditions for suspended particles to settle by gravity. Sedimentation basins feature inlet and outlet structures to minimize short-circuiting, sludge collection systems, and are sized to achieve desired particle removal efficiency based on settling velocities.'
          },
          {
            term: 'Solids-Contact Basin',
            definition: 'A treatment unit that combines rapid mix, flocculation, and sedimentation processes in a single basin, often incorporating sludge recirculation to enhance particle contact and removal efficiency. Solids-contact basins provide more compact treatment with improved floc formation through increased particle collision opportunities and reduced detention time requirements.'
          },
          {
            term: 'Dewatering',
            definition: 'The process of removing water from sludge or settled solids to reduce volume, improve handling characteristics, and prepare waste materials for disposal or beneficial reuse. Dewatering methods include gravity thickening, mechanical dewatering using belt presses or centrifuges, and drying beds to achieve desired solids content.'
          },
          {
            term: 'Magnesium Hardness',
            definition: 'Water hardness caused by dissolved magnesium ions (Mg²⁺), which requires special treatment considerations in lime softening processes. Magnesium hardness removal requires higher pH conditions (above 10.5) and often necessitates two-stage lime treatment or excess lime addition followed by recarbonation to achieve effective precipitation and removal.'
          },
          {
            term: 'Coagulation-Flocculation',
            definition: 'The two-stage process of adding coagulant chemicals to destabilize particles (coagulation) followed by gentle mixing to promote particle agglomeration (flocculation). This process is essential for removing suspended solids, turbidity, and associated contaminants, and is often integrated with lime softening to improve overall treatment efficiency.'
          },
          {
            term: 'Trihalomethane (THM)',
            definition: 'A group of disinfection by-products formed when chlorine reacts with natural organic matter in water, including chloroform and other halogenated compounds. THMs are regulated as potential carcinogens, and lime softening can help reduce THM formation potential by removing organic precursors and providing pH control that affects chlorine chemistry.'
          }
        ]
      }
    }
  }
};

// Flashcard Application Class
class FlashcardApp {
  constructor() {
    this.currentBook = null;
    this.currentChapter = null;
    this.currentCards = [];
    this.currentCardIndex = 0;
    this.isFlipped = false;
    this.studyMode = 'sequential'; // or 'random'
    this.cardDifficulties = {};
    this.favorites = new Set();
    this.studyStats = {
      cardsStudied: 0,
      correctAnswers: 0,
      startTime: null
    };
    
    this.loadData();
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.showBookSelection();
  }

  loadData() {
    // Load saved progress from localStorage
    const savedFavorites = localStorage.getItem('flashcard-favorites');
    if (savedFavorites) {
      this.favorites = new Set(JSON.parse(savedFavorites));
    }

    const savedDifficulties = localStorage.getItem('flashcard-difficulties');
    if (savedDifficulties) {
      this.cardDifficulties = JSON.parse(savedDifficulties);
    }
  }

  saveData() {
    localStorage.setItem('flashcard-favorites', JSON.stringify([...this.favorites]));
    localStorage.setItem('flashcard-difficulties', JSON.stringify(this.cardDifficulties));
  }

  setupEventListeners() {
    // Book selection
    document.querySelectorAll('.book-card.available').forEach(card => {
      card.addEventListener('click', () => {
        const bookId = card.dataset.book;
        this.selectBook(bookId);
      });
    });

    // Chapter selection - using event delegation to ensure all cards are clickable
    document.addEventListener('click', (e) => {
      const chapterCard = e.target.closest('.chapter-card');
      if (chapterCard && chapterCard.dataset.chapter) {
        const chapterId = chapterCard.dataset.chapter;
        this.selectChapter(chapterId);
      }
    });

    // Navigation
    document.getElementById('backToBooksHeader').addEventListener('click', () => {
      this.showBookSelection();
    });

    document.getElementById('backToChaptersHeader').addEventListener('click', () => {
      this.showChapterSelection();
    });

    document.getElementById('backToBooks').addEventListener('click', () => {
      this.showBookSelection();
    });

    // Flashcard interactions
    document.getElementById('flashcard').addEventListener('click', () => {
      this.flipCard();
    });

    // Card navigation
    document.getElementById('prevCard').addEventListener('click', () => {
      this.previousCard();
    });

    document.getElementById('nextCard').addEventListener('click', () => {
      this.nextCard();
    });

    // Control buttons
    document.getElementById('shuffleBtn').addEventListener('click', () => {
      this.shuffleCards();
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
      this.resetProgress();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (this.currentBook) {
        switch(e.key) {
          case ' ':
          case 'Enter':
            e.preventDefault();
            this.flipCard();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            this.previousCard();
            break;
          case 'ArrowRight':
            e.preventDefault();
            this.nextCard();
            break;
          case 's':
            this.shuffleCards();
            break;
        }
      }
    });
  }

  showBookSelection() {
    document.getElementById('bookSelection').classList.remove('hidden');
    document.getElementById('chapterSelection').classList.add('hidden');
    document.getElementById('studyInterface').classList.add('hidden');
    document.getElementById('studyInfo').classList.add('hidden');
    document.getElementById('headerTagline').classList.remove('hidden');
    this.currentBook = null;
    this.currentChapter = null;
  }

  showChapterSelection() {
    if (!this.currentBook || !flashcardData[this.currentBook].chapters) {
      this.showBookSelection();
      return;
    }

    document.getElementById('bookSelection').classList.add('hidden');
    document.getElementById('chapterSelection').classList.remove('hidden');
    document.getElementById('studyInterface').classList.add('hidden');
    document.getElementById('studyInfo').classList.add('hidden');
    document.getElementById('headerTagline').classList.add('hidden');
    this.currentChapter = null;
  }

  selectBook(bookId) {
    if (!flashcardData[bookId]) {
      this.showToast('This book is not available yet. Coming soon!');
      return;
    }

    // Check if book has chapters or cards
    if (flashcardData[bookId].chapters) {
      // Show chapter selection
      this.currentBook = bookId;
      document.getElementById('bookSelection').classList.add('hidden');
      document.getElementById('chapterSelection').classList.remove('hidden');
      document.getElementById('headerTagline').classList.add('hidden');
      return;
    } else if (flashcardData[bookId].cards && flashcardData[bookId].cards.length === 0) {
      this.showToast('This book is not available yet. Coming soon!');
      return;
    }

    // Legacy books with direct cards array
    this.currentBook = bookId;
    this.currentCards = [...flashcardData[bookId].cards];
    this.startStudy();
  }

  selectChapter(chapterId) {
    if (!this.currentBook || !flashcardData[this.currentBook].chapters) {
      return;
    }

    this.currentChapter = chapterId;
    
    if (chapterId === 'all') {
      // Combine all chapters
      this.currentCards = [];
      Object.values(flashcardData[this.currentBook].chapters).forEach(chapter => {
        this.currentCards = this.currentCards.concat(chapter.cards);
      });
    } else {
      // Select specific chapter
      this.currentCards = [...flashcardData[this.currentBook].chapters[chapterId].cards];
    }

    this.startStudy();
  }

  startStudy() {
    this.currentCardIndex = 0;
    this.studyStats.startTime = Date.now();
    this.studyStats.cardsStudied = 0;
    this.studyStats.correctAnswers = 0;

    document.getElementById('bookSelection').classList.add('hidden');
    document.getElementById('chapterSelection').classList.add('hidden');
    document.getElementById('studyInterface').classList.remove('hidden');
    document.getElementById('studyInfo').classList.remove('hidden');
    document.getElementById('headerTagline').classList.add('hidden');
    
    let headerText = flashcardData[this.currentBook].title;
    if (this.currentChapter && this.currentChapter !== 'all') {
      headerText += ' - ' + flashcardData[this.currentBook].chapters[this.currentChapter].title;
    } else if (this.currentChapter === 'all') {
      headerText += ' - All Chapters';
    }
    
    document.getElementById('currentBookHeader').textContent = headerText;
    document.getElementById('totalCards').textContent = this.currentCards.length;

    // Show/hide chapter button based on book structure
    const chapterBtn = document.getElementById('backToChaptersHeader');
    if (flashcardData[this.currentBook].chapters) {
      chapterBtn.classList.remove('hidden');
    } else {
      chapterBtn.classList.add('hidden');
    }

    this.displayCurrentCard();
    this.updateNavigationButtons();
  }

  displayCurrentCard() {
    if (this.currentCards.length === 0) return;

    const card = this.currentCards[this.currentCardIndex];
    document.getElementById('cardTerm').textContent = card.term;
    document.getElementById('cardDefinition').textContent = card.definition;
    document.getElementById('currentCard').textContent = this.currentCardIndex + 1;

    // Reset flip state
    this.isFlipped = false;
    document.getElementById('flashcard').classList.remove('flipped');

  }

  flipCard() {
    this.isFlipped = !this.isFlipped;
    const flashcard = document.getElementById('flashcard');
    
    if (this.isFlipped) {
      flashcard.classList.add('flipped');
    } else {
      flashcard.classList.remove('flipped');
    }
  }

  nextCard() {
    if (this.currentCardIndex < this.currentCards.length - 1) {
      this.currentCardIndex++;
    } else {
      this.currentCardIndex = 0; // Loop back to first card
    }
    this.displayCurrentCard();
    this.updateNavigationButtons();
  }

  previousCard() {
    if (this.currentCardIndex > 0) {
      this.currentCardIndex--;
    } else {
      this.currentCardIndex = this.currentCards.length - 1; // Loop to last card
    }
    this.displayCurrentCard();
    this.updateNavigationButtons();
  }

  updateNavigationButtons() {
    const prevBtn = document.getElementById('prevCard');
    const nextBtn = document.getElementById('nextCard');
    
    // For now, always enable both buttons to allow looping
    prevBtn.disabled = false;
    nextBtn.disabled = false;
  }

  shuffleCards() {
    // Fisher-Yates shuffle algorithm
    for (let i = this.currentCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.currentCards[i], this.currentCards[j]] = [this.currentCards[j], this.currentCards[i]];
    }
    
    this.currentCardIndex = 0;
    this.displayCurrentCard();
    this.updateNavigationButtons();
    this.showToast('Cards shuffled!');
  }





  setStudyMode(mode) {
    this.studyMode = mode;
    if (mode === 'random') {
      this.shuffleCards();
    }
    this.closeModal();
    this.showToast(`Study mode: ${mode}`);
  }

  showFavoritesOnly() {
    const favoriteCards = this.currentCards.filter(card => {
      const cardKey = `${this.currentBook}-${this.currentChapter || 'all'}-${card.term}`;
      return this.favorites.has(cardKey);
    });

    if (favoriteCards.length === 0) {
      this.showToast('No favorite cards yet!');
      return;
    }

    this.currentCards = favoriteCards;
    this.currentCardIndex = 0;
    this.displayCurrentCard();
    this.updateNavigationButtons();
    
    document.getElementById('totalCards').textContent = this.currentCards.length;
    this.closeModal();
    this.showToast(`Studying ${favoriteCards.length} favorite cards`);
  }

  resetProgress() {
    if (confirm('Are you sure you want to reset your progress for this book?')) {
      // Reset current session stats
      this.studyStats = {
        cardsStudied: 0,
        correctAnswers: 0,
        startTime: Date.now()
      };

      // Clear difficulties for current book/chapter
      const prefix = `${this.currentBook}-${this.currentChapter || 'all'}-`;
      Object.keys(this.cardDifficulties).forEach(key => {
        if (key.startsWith(prefix)) {
          delete this.cardDifficulties[key];
        }
      });

      // Clear favorites for current book/chapter
      const currentFavorites = [...this.favorites].filter(key => 
        key.startsWith(prefix)
      );
      currentFavorites.forEach(key => this.favorites.delete(key));

      // Reset cards to original order
      if (this.currentChapter === 'all') {
        this.currentCards = [];
        Object.values(flashcardData[this.currentBook].chapters).forEach(chapter => {
          this.currentCards = this.currentCards.concat(chapter.cards);
        });
      } else if (this.currentChapter) {
        this.currentCards = [...flashcardData[this.currentBook].chapters[this.currentChapter].cards];
      } else {
        this.currentCards = [...flashcardData[this.currentBook].cards];
      }
      this.currentCardIndex = 0;
      
      this.saveData();
      this.displayCurrentCard();
      this.updateNavigationButtons();
        
      document.getElementById('totalCards').textContent = this.currentCards.length;
      
      this.showToast('Progress reset successfully!');
    }
  }

  showModal(html) {
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = html;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeModal();
      }
    });

    document.body.appendChild(overlay);

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  }

  closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
      modal.remove();
    }
  }

  showToast(message) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Add additional modal styles for options
const additionalStyles = `
  .option-group {
    margin-bottom: 2rem;
  }

  .option-group h4 {
    color: #00677f;
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  .option-group .modal-btn {
    margin-right: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .shortcuts-info {
    background: rgba(0, 103, 127, 0.05);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid rgba(0, 103, 127, 0.1);
  }

  .shortcuts-info p {
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }

  .shortcuts-info strong {
    color: #00677f;
  }

  @media (max-width: 768px) {
    .modal-actions {
      justify-content: center;
    }
    
    .modal-btn {
      flex: 1;
      min-width: 120px;
    }
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = additionalStyles;
document.head.appendChild(styleElement);

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new FlashcardApp();
});