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

let removed_items = [];

const chart = document.getElementById("chart");
const total_amount = document.getElementById("total-amount");
const legend = document.getElementById("legend");

const map = document.getElementById("map");

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

        // Specify the chart’s dimensions.
        const width = 1189;
        const height = 452.2;
        // Specify the color scale.
        const color = d3.scaleOrdinal(data.children.map(d => d.name), [
            "#F2AA86",
            "#F4CE0F",
            "#EDB73E",
            "#A0D447",
            "#A53200",
            "#ED40F2",
            "#FF73FF",
            "#6DF2B0",
            "#DD0E31",
            "#EFDC81",
            "#02A347",
            "#2CBA0F",
            "#F46D2A",
            "#892EFF",
            "#AA7329",
            "#2E97FF",
            "#69C8ED",
            "#9E0071",
            "#9CF2CF",
            "#9C9FB2",
            "#847290",
            "red"
        ]);

        // Compute the layout.
        const root = d3.treemap()
            .tile(d3.treemapSquarify)
            .size([width, height])
            .padding(1)
            .round(true)
        (d3.hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value));

        // Create the SVG container.
        const svg = d3.create("svg")
            .attr("viewBox", [0, 0, width, height])
            .attr("width", width)
            .attr("height", height)
            .attr("style", "max-width: 100%; height: auto; font: 20px sans-serif;");

        const format1 = d3.format("$.3~s");
        const format2 = d3.format(".3~p");
        let total = root.value;

        total_amount.innerHTML = `Total: ${format1(total).replace(/G/,"B")}`;

        /* svg.append("text")
            .attr("x", "50%")
            .attr("text-anchor", "middle")
            .attr("font-family", "Open Sans")
            .attr("font-size", "18px")
            .text(d => "Total: " + format1(total).replace(/G/,"B")); */

        // Add a cell for each leaf of the hierarchy.
        const leaf = svg.selectAll("g")
            .data(root.leaves())
            .join("g")
            .attr("transform", d => `translate(${d.x0},${d.y0})`);

        // Append a tooltip.
        leaf.append("title")
            .text(d => 
                //`${d.ancestors().reverse().map(d => d.data.name).join(".")}\n${format1(d.value).replace(/G/,"B")}`
                `${d.data.name}\n${format1(d.value).replace(/G/,"B")}\n${format2(d.value/total)}`
            );

        // Append a color rectangle. 
        leaf.append("rect")
            .attr("id", d => (d.leafUid = uid("leaf")).id)
            .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
            .attr("fill-opacity", 1)
            .attr("width", d => d.x1 - d.x0)
            .attr("height", d => d.y1 - d.y0);

        // Append a clipPath to ensure text does not overflow.
        leaf.append("clipPath")
            .attr("id", d => (d.clipUid = uid("clip")).id)
            .append("use")
            .attr("xlink:href", d => d.leafUid.href);

        // Append multiline text. The last line shows the value and has a specific formatting.
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
            .data(d => d.data.name.split(/(?=[A-Z][a-z])|\s+/g).concat(format2(d.value/total)))
            .join("tspan")
            .attr("x", 3)
            .attr("y", (d, i, nodes) => `${(i === nodes.length - 1) * 0.3 + 1.1 + i * 0.9}em`)
            .attr("fill-opacity", (d, i, nodes) => i === nodes.length - 1 ? 0.7 : null)
            .text(d => d);


        // Create the SVG for the legend container.
        const svg_legend = d3.create("svg")
            .attr("width", width)
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
                let index = data.children.findIndex(section => section.name === d.srcElement.__data__);
                if(index != -1){
                    removed_items.push(data.children[index]);
                    data.children.splice(index, 1);
                }
            })
            .attr("fill", d => color(d))
            .attr("fill-opacity", 1)
            .attr("width", 25)
            .attr("height", 25);
            
        chart.append(svg.node());
        legend.append(svg_legend.node());
    });


fetch("dptos.geojson")
    .then(response => response.json())
    .then(json => { 
        let data = json;

        let center = d3.geoCentroid(data);
        let projection = d3.geoConicEqualArea()
            .parallels([0, 0])
            .center(center);

        projection.fitSize([800, 600], data);


        const svg_map = d3.create("svg")
            .attr("viewBox", [0, 0, 800, 600])
            .attr("width", 800)
            .attr("height", 600);

        svg_map.append("g")
            .attr("stroke", "#000000")
            .attr("stroke-width", ".98")
            .attr("fill", "#FFFFFF")
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .selectAll()
            .data(data.features)
            .join("path")
            .attr("d", d3.geoPath().projection(projection));

        map.append(svg_map.node());
    });