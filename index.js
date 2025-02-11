var count = 0;

function uid(name) {
  return new Id("O-" + (name == null ? "" : name + "-") + ++count);
}

function Id(id) {
  this.id = id;
  this.href = new URL(`#${id}`, location) + "";
}

Id.prototype.toString = function() {
  return "url(" + this.href + ")";
};

const format1 = d3.format("$.3~s");
const format2 = d3.format(".3~p");
const chart_width = 1189;
const chart_height = 452.2;
const removed_items = [];

const chart = document.getElementById("chart");
const total_amount = document.getElementById("total-amount");
const legend = document.getElementById("legend");

fetch("https://oec.world/api/olap-proxy/data?cube=trade_i_baci_a_92&drilldowns=Year,HS4&measures=Trade+Value&parents=true&Year=2022&Exporter+Country=saper")
    .then(response => response.json())
    .then(json => {
        let data = json.data;

        // rearrange data
        data = data.reduce(
            (arr, obj) => {
                if(!arr.find(item => item.name === obj["Section"])){
                    let section = {name: obj["Section"], children: []};
                    section.children = data.reduce(
                        (arr2, obj2) => {
                            if(section.name === obj2["Section"] && !arr2.find(item => item.name === obj2["HS2"])){
                                let hs2 = {name: obj2["HS2"], children: []};
                                hs2.children = data.reduce(
                                    (arr3, obj3) => {
                                        if(hs2.name === obj3["HS2"] && !arr3.find(item => item.name === obj3["HS4"])){
                                            let hs4 = {name: obj3["HS4"], value: obj3["Trade Value"]};
                                            arr3.push(hs4);
                                        }
                                        return arr3;
                                    },
                                    []
                                );
                                arr2.push(hs2);
                            }
                            return arr2;
                        },
                        []
                    );
                    arr.push(section);
                }
                return arr;
            },
            []
        );

        data = {name: "root", children: data}
        
        // Specify the color scale.
        const color = d3.scaleOrdinal(data.children.map(d => d.name), 
            [
                "#F2AA86", "#F4CE0F", "#EDB73E", "#A0D447", "#A53200", "#ED40F2",
                "#FF73FF", "#6DF2B0", "#DD0E31", "#EFDC81", "#02A347", "#2CBA0F",
                "#F46D2A", "#892EFF", "#AA7329", "#2E97FF", "#69C8ED", "#9E0071",
                "#9CF2CF", "#9C9FB2", "#847290", "red"
            ]);

        // Create the SVG container.
        const svg = d3.create("svg")
            .attr("viewBox", [0, 0, chart_width, chart_height])
            .attr("width", chart_width)
            .attr("height", chart_height)
            .attr("style", "max-width: 100%; height: auto; font: 20px sans-serif;");

        drawTree(svg, data, color);
        /* svg.append("text")
            .attr("x", "50%")
            .attr("text-anchor", "middle")
            .attr("font-family", "Open Sans")
            .attr("font-size", "18px")
            .text(d => "Total: " + format1(total).replace(/G/,"B")); */

        // Add a cell for each leaf of the hierarchy.

        // Create the SVG for the legend container.
        const svg_legend = d3.create("svg")
            .attr("width", chart_width)
            .attr("height", 25);

        const legend_leaf = svg_legend.selectAll("g")
            .data(data.children.map(d => d.name))
            .join("g")
            .attr("transform", (d,i) => `translate(${i*30},0)`)

        legend_leaf.append("title")
            .text(d => `${d}`)

        legend_leaf.append("rect")
            .attr("id", d => (d.legendUid = uid("legend")).id)
            .on("click", d => {
                d3.select("#chart").select("svg").selectAll("g").remove();
                let index = data.children.findIndex(section => section.name === d.srcElement.__data__);
                if(index != -1){
                    removed_items.push(data.children[index]);
                    data.children.splice(index, 1);
                }
                else {
                    index = removed_items.findIndex(section => section.name === d.srcElement.__data__);
                    data.children.push(removed_items[index]);
                    removed_items.splice(index, 1);
                }
                drawTree(svg, data, color);
            })
            .attr("fill", d => color(d))
            .attr("fill-opacity", 1)
            .attr("width", 25)
            .attr("height", 25);
            
        chart.append(svg.node());
        legend.append(svg_legend.node());
    });


function drawTree(svg, data, color) {
    const root = d3.treemap()
        .tile(d3.treemapSquarify)
        .size([chart_width, chart_height])
        .padding(1)
        .round(true)
    (d3.hierarchy(data)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value));

    const leaf = svg.selectAll("g")
        .data(root.leaves())
        .join("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    leaf.append("title")
        .text(d => 
            `${d.data.name}\n${format1(d.value).replace(/G/,"B")}\n${format2(d.value/root.value)}`
        );

    leaf.append("rect")
        .attr("id", d => (d.leafUid = uid("leaf")).id)
        .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
        .attr("fill-opacity", 1)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0);

    leaf.append("clipPath")
        .attr("id", d => (d.clipUid = uid("clip")).id)
        .append("use")
        .attr("xlink:href", d => d.leafUid.href);

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
        .data(d => d.data.name.split(/(?=[A-Z][a-z])|\s+/g).concat(format2(d.value/root.value)))
        .join("tspan")
        .attr("x", 3)
        .attr("y", (d, i, nodes) => `${(i === nodes.length - 1) * 0.3 + 1.1 + i * 0.9}em`)
        .attr("fill-opacity", (d, i, nodes) => i === nodes.length - 1 ? 0.7 : null)
        .text(d => d);

    total_amount.innerHTML = `Total: ${format1(root.value).replace(/G/,"B")}`;
}

const map = document.getElementById("map");

fetch("dptos.geojson")
    .then(response => response.json())
    .then(json => { 
        let data = json;

        data.features.sort((a,b) => b.properties.PBI - a.properties.PBI);
        const pbi_color = d3.scaleOrdinal(data.features.map(d => d.properties.NOMBDEP), 
            [
                "#002c5c", "#003064", "#00346c", "#003974", "#003d7b", 
                "#004183", "#004589", "#004990", "#004c98", "#00509f", 
                "#0054a6", "#0057ad", "#005bb3", "#005fb9", "#0062c0", 
                "#0065c6", "#0069cc", "#006cd3", "#0070d9", "#0073df", 
                "#0076e6", "#007aec", "#007df2", "#0081f9", "#0084ff"
            ]);

        data.features.sort((a,b) => b.properties.HECTARES - a.properties.HECTARES);
        const hect_color = d3.scaleOrdinal(data.features.map(d => d.properties.NOMBDEP), 
            [
                "#5c0000", "#620000", "#680000", "#6f0000", "#750000", 
                "#7b0000", "#800000", "#860000", "#8c0000", "#910000", 
                "#970000", "#9d0000", "#a20000", "#a70000", "#ad0000", 
                "#b20000", "#b70000", "#bc0000", "#c10000", "#c70000", 
                "#cc0000", "#d10000", "#d60000", "#db0000", "#e00000"
            ]);

        let center = d3.geoCentroid(data);
        let projection = d3.geoConicEqualArea()
            .parallels([0, 0])
            .center(center);

        projection.fitSize([800, 600], data);

        const svg_map = d3.create("svg")
            .attr("viewBox", [0, 0, 800, 600])
            .attr("width", 800)
            .attr("height", 600);

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

        d3.select("#pbi-rect").on("click", d => {
            paintMap(dept, pbi_color);
            dept.append("title")
                .text(d => d.properties.NOMBDEP+"\n"+format1(d.properties.PBI));
        });
        d3.select("#hect-rect").on("click", d => {
            paintMap(dept, hect_color);
            dept.append("title")
                .text(d => d.properties.NOMBDEP+"\n"+d.properties.HECTARES+" ha");
        });

        map.append(svg_map.node());
    });

function paintMap(dept, color){ 
    dept.select("title").remove();
    dept.attr("stroke", "#FFFFFF");
    dept.attr('fill',  d => color(d.properties.NOMBDEP));
}