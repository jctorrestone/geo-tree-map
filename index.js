const currency_format = d3.format("$.3~s");
const percent_format = d3.format(".3~p");
const chart_width = 1189;
const chart_height = 452.2;
const removed_items = [];

const chart = document.getElementById("chart");
const chart_total = document.getElementById("chart-total");
const chart_legend = document.getElementById("chart-legend");

// Fetch the data from oec API
fetch("https://oec.world/api/olap-proxy/data?cube=trade_i_baci_a_92&drilldowns=Year,HS4&measures=Trade+Value&parents=true&Year=2022&Exporter+Country=saper")
    .then(response => response.json())
    .then(json => {
        // Rearrange the data
        const data = rearrange(json.data);
        
        // Specify the color scale for the section properties
        const chart_color = d3.scaleOrdinal(data.children.map(d => d.name), 
            [
                "#F2AA86", "#F4CE0F", "#EDB73E", "#A0D447", "#A53200", "#ED40F2",
                "#FF73FF", "#6DF2B0", "#DD0E31", "#EFDC81", "#02A347", "#2CBA0F",
                "#F46D2A", "#892EFF", "#AA7329", "#2E97FF", "#69C8ED", "#9E0071",
                "#9CF2CF", "#9C9FB2", "#847290", "red"
            ]);

        // Create a SVG container for the treemap
        const chart_svg = d3.create("svg")
            .attr("viewBox", [0, 0, chart_width, chart_height])
            .attr("width", chart_width)
            .attr("height", chart_height)
            .attr("style", "max-width: 100%; height: auto; font: 20px sans-serif;");

        // Draw the treemap inside the svg we just created
        drawTree(chart_svg, data, chart_color);

        // Create a SVG container for the map legend
        const legend_svg = d3.create("svg")
            .attr("width", chart_width)
            .attr("height", 25);

        // Join each section name with a g element and set its position
        const legend_leaf = legend_svg.selectAll("g")
            .data(data.children.map(d => d.name))
            .join("g")
            .attr("transform", (d,i) => `translate(${i*30},0)`)

        // Assign a tooltip for each g element
        legend_leaf.append("title")
            .text(d => `${d}`)

        // Assign a rect element for each g element with the respective color
        // If the rect element is clicked it will enable or disable that section from the treemap
        legend_leaf.append("rect")
            .attr("fill", d => chart_color(d))
            .attr("fill-opacity", 1)
            .attr("width", 25)
            .attr("height", 25)
            .on("click", (e, d) => {
                d3.select("#chart").select("svg").selectAll("g").remove();
                let index = data.children.findIndex(section => section.name === d);
                
                if(index != -1){
                    removed_items.push(data.children[index]);
                    data.children.splice(index, 1);
                    e.target.classList = "disabled";
                }
                else {
                    index = removed_items.findIndex(section => section.name === d);
                    data.children.push(removed_items[index]);
                    removed_items.splice(index, 1);
                    e.target.classList = "";
                }
                
                drawTree(chart_svg, data, chart_color);
            });
            
        chart.append(chart_svg.node());
        chart_legend.append(legend_svg.node());
    });

// This method restructures the data in order to match the {name, children} structure
function rearrange(data){
    const names = ["Section", "HS2", "HS4"];
    const root = {name: "root", children: []}
    
    data.forEach((obj) => {
        names.reduce((current, name) => {
            let index = current.findIndex(element => element.name === obj[name])
            if(index != -1) {
                return current[index].children;
            }
            else {
                let new_current = createObj(obj, name);
                current.push(new_current);
                return new_current.children? new_current.children : new_current;
            }
        }, root.children);
    });

    return root;
}

// This method is called inside rearrange(), and returns a new object with the
// corresponding name and empty children/value
function createObj(obj, name){
    if(name !== "HS4"){
        return {name: obj[name], children: []};
    }

    return {name: obj[name], value: obj["Trade Value"]};
}

// This method draws the treemap with the corresponding data and color scale
function drawTree(svg, data, color) {
    // Create a treemap with the tiling method Squarify and sort the data
    const root = d3.treemap()
        .tile(d3.treemapSquarify)
        .size([chart_width, chart_height])
        .padding(1)
        .round(true)
    (d3.hierarchy(data)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value));

    // Join every leaf of the tree with a g element and set its position
    const leaf = svg.selectAll("g")
        .data(root.leaves())
        .join("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    // Append a tooltip to each g element (leaf)
    leaf.append("title")
        .text(d => 
            `${d.data.name}\n${currency_format(d.value).replace(/G/,"B")}\n${percent_format(d.value/root.value)}`
        );

    // Append a rect element to each g element with the respective color
    leaf.append("rect")
        .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
        .attr("fill-opacity", 1)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0);

    leaf.append("clipPath")
        .append("use");

    // Add text that will appear in each tile
    leaf.append("text")
        .attr("clip-path", d => d.clipUid)
        .attr("font-size", d => {
            let w = d.x1 - d.x0;
            let h = d.y1 - d.y0;
            if(w > h)
                return `${0.8*h}%`;
            return `${0.8*w}%`;
        })
        .selectAll("tspan")
        .data(d => d.data.name.split(/(?=[A-Z][a-z])|\s+/g).concat(percent_format(d.value/root.value)))
        .join("tspan")
        .attr("x", 3)
        .attr("y", (d, i, nodes) => `${(i === nodes.length - 1) * 0.3 + 1.1 + i * 0.9}em`)
        .attr("fill-opacity", (d, i, nodes) => i === nodes.length - 1 ? 0.7 : null)
        .text(d => d);

    chart_total.innerHTML = `Total: ${currency_format(root.value).replace(/G/,"B")}`;
}

const map = document.getElementById("map");

// Fetch the data from local source
fetch("dptos.geojson")
    .then(response => response.json())
    .then(json => { 
        const data = json;
        const map_width = 800;
        const map_height = 600;

        // Sort the data in order to specify the color scale for PBI
        data.features.sort((a,b) => b.properties.PBI - a.properties.PBI);
        const pbi_color = d3.scaleOrdinal(data.features.map(d => d.properties.NOMBDEP), 
            [
                "#002c5c", "#003064", "#00346c", "#003974", "#003d7b", 
                "#004183", "#004589", "#004990", "#004c98", "#00509f", 
                "#0054a6", "#0057ad", "#005bb3", "#005fb9", "#0062c0", 
                "#0065c6", "#0069cc", "#006cd3", "#0070d9", "#0073df", 
                "#0076e6", "#007aec", "#007df2", "#0081f9", "#0084ff"
            ]);

        // Sort the data in order to specify the color scale for Area
        data.features.sort((a,b) => b.properties.HECTARES - a.properties.HECTARES);
        const hect_color = d3.scaleOrdinal(data.features.map(d => d.properties.NOMBDEP), 
            [
                "#5c0000", "#620000", "#680000", "#6f0000", "#750000", 
                "#7b0000", "#800000", "#860000", "#8c0000", "#910000", 
                "#970000", "#9d0000", "#a20000", "#a70000", "#ad0000", 
                "#b20000", "#b70000", "#bc0000", "#c10000", "#c70000", 
                "#cc0000", "#d10000", "#d60000", "#db0000", "#e00000"
            ]);

        // Calculate the center of the map and set the data for the projection
        const center = d3.geoCentroid(data);
        const projection = d3.geoConicEqualArea()
            .parallels([0, 0])
            .center(center)
            .fitSize([map_width, map_height], data);

        // Create the svg container for the geomap
        const svg_map = d3.create("svg")
            .attr("viewBox", [0, 0, map_width, map_height])
            .attr("width", map_width)
            .attr("height", map_height);

        // Join each data.feature with with its respective path, and set its projection
        const dept = svg_map.append("g")
            .attr("stroke", "#000000")
            .attr("stroke-width", ".98")
            .attr("fill", "#FFFFFF")
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .selectAll()
            .data(data.features)
            .join("path")
            .attr("d", d3.geoPath(projection));

        // If the rect tag for pbi is clicked, it will paint the map with the respective color
        // and show the respective tooltips
        d3.select("#pbi-rect")
            .on("click", (e, d) => {
                paintMap(dept, pbi_color);
                dept.append("title")
                    .text(d => d.properties.NOMBDEP+"\n"+currency_format(d.properties.PBI));
                e.target.classList = "";
                d3.select("#hect-rect")
                    .attr("class", "disabled");
            });

        // If the rect tag for area is clicked, it will paint the map with the respective color
        // and show the respective tooltips
        d3.select("#hect-rect")
            .on("click", (e, d) => {
                paintMap(dept, hect_color);
                dept.append("title")
                    .text(d => d.properties.NOMBDEP+"\n"+d.properties.HECTARES+" ha");
                e.target.classList = "";
                d3.select("#pbi-rect")
                    .attr("class", "disabled");
            });

        map.append(svg_map.node());
    });

// This function removes every tooltip from each path and paints it with the chosen color
function paintMap(dept, color){ 
    dept.select("title").remove();
    dept.attr("stroke", "#FFFFFF")
        .attr('fill',  d => color(d.properties.NOMBDEP));
}