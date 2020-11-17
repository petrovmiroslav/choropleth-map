import React from 'react';
import {min as Min, max as Max, range as Range} from "d3-array";
import {create as Create, select as Select} from "d3-selection";
import {axisBottom as AxisBottom} from "d3-axis";
import {geoPath as Path} from "d3-geo";
import {schemeReds as SchemeReds} from "d3-scale-chromatic";
import {scaleQuantize as ScaleQuantize, scaleLinear as ScaleLinear} from "d3-scale";
import {feature as TopoFeature, mesh as TopoMesh} from "topojson-client";
import './App.css';

class Choropleth extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      loading: true,
      error: false,
      map: null,
      data: null,
      clientW: 0,
      timerID: 0,
      tooltip: {
        text: 'Template County,\nTM: 00.0%',
        clientW: 0,
        pos: {
          top: 0,
          left: 0,
          width: 0
        },
        style: {
          transform: `translate3d(0, 0, 0)`,
          opacity: 0
        }
      }
    };

    this.svgRef = React.createRef();
    this.tooltipRef = React.createRef();

    this.mouseoverHandler = this.mouseoverHandler.bind(this);
    this.mouseoutHandler = this.mouseoutHandler.bind(this);
    this.resizeHandler = this.resizeHandler.bind(this);
    this.resizeTooltip = this.resizeTooltip.bind(this);
    this.getData = this.getData.bind(this);
  }

  componentDidMount () {
    window.addEventListener('resize', this.resizeHandler);
    this.resizeTooltip();
    this.getData();
  }

  componentWillUnmount () {
    window.removeEventListener('resize', this.resizeHandler);
  }

  getData () {
    this.setState({
      loading: true,
      error: false
    });
    this.fetchData('https://raw.githubusercontent.com/no-stack-dub-sack/testable-projects-fcc/master/src/data/choropleth_map/counties.json', this.fetchMapResultHandler);
    this.fetchData('https://raw.githubusercontent.com/no-stack-dub-sack/testable-projects-fcc/master/src/data/choropleth_map/for_user_education.json', this.fetchDataResultHandler);
  }

  fetchData (url, callback) {
    fetch(url)
    .then(r => r.json())
    .then(callback.bind(this), 
          this.fetchErrorHandler.bind(this));
  }

  fetchMapResultHandler (result) {
    this.setState({map: result});
    this.createMap();
  }

  fetchDataResultHandler (result) {
    const arr = result.map(d => [d.fips, d]),
    dataMin = Min(arr, d => d[1].bachelorsOrHigher),
    dataMax = Max(arr, d => d[1].bachelorsOrHigher);

    this.setState({
      data: new Map(arr),
      dataMin: dataMin,
      dataMax: dataMax,
      color: ScaleQuantize([dataMin, dataMax], SchemeReds[9])
    });
    this.createMap();
  }

  fetchErrorHandler (err) {
    this.setState({
      error: true
    });
  }

  resizeHandler () {
    window.clearTimeout(this.state.timerID);
    this.setState({
      timerID: window.setTimeout(this.resizeTooltip, 100)
    });
  }

  resizeTooltip () {
    this.setState({
      tooltip: this.setTooltipPos(),
      clientW: document.documentElement.clientWidth
    });
  }

  setTooltipPos () {
    let tooltip = Object.assign({}, this.state.tooltip),
      tooltipRECT;
    try {
      tooltipRECT = this.tooltipRef.current.getBoundingClientRect();
      tooltip.pos = {
        top: tooltipRECT.top,
        left: tooltipRECT.left,
        width: tooltipRECT.width,
        height: tooltipRECT.height
      }
    } catch (e) {
      console.log(e);
      tooltip.pos = {
        top: 0,
        left: 0,
        width: 172,
        height: 66
      }
    }
    return tooltip;
  }

  legend ({
    color,
    title,
    tickSize = 6,
    width = 320, 
    height = 44 + tickSize,
    marginTop = 18,
    marginRight = 0,
    marginBottom = 16 + tickSize,
    marginLeft = 0,
    ticks = width / 64,
    tickFormat,
    tickValues
  } = {}) {
    const svg = Create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .style("overflow", "visible")
      .style("display", "block");

    const tickAdjust = g => g.selectAll(".tick line").attr("y1", marginTop + marginBottom - height),
    thresholds = color.thresholds(),
    thresholdFormat = tickFormat,
    x = ScaleLinear()
      .domain([-1, color.range().length - 1])
      .rangeRound([marginLeft, width - marginRight]);
    tickValues = Range(thresholds.length);
    tickFormat = i => thresholdFormat(thresholds[i], i);

    svg.append("g")
      .selectAll("rect")
      .data(color.range())
      .join("rect")
        .attr("x", (d, i) => x(i - 1))
        .attr("y", marginTop)
        .attr("width", (d, i) => x(i) - x(i - 1))
        .attr("height", height - marginTop - marginBottom)
        .attr("fill", d => d);

    svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(AxisBottom(x)
        .ticks(ticks, typeof tickFormat === "string" ? tickFormat : undefined)
        .tickFormat(typeof tickFormat === "function" ? tickFormat : undefined)
        .tickSize(tickSize)
        .tickValues(tickValues))
      .call(tickAdjust)
      .call(g => g.select(".domain").remove())
      .call(g => g.append("text")
        .attr("x", marginLeft)
        .attr("y", marginTop + marginBottom - height - 6)
        .attr("fill", "currentColor")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .attr("font-size", "14px")
        .text(title));

    return svg.node();
  }

  createMap () {
    if (!this.state.map || !this.state.data) return;
    this.setState({loading: false, error: false});

    const svg = Select(this.svgRef.current)
      .attr("viewBox", [0, 0, 975, 610]);

    svg.append("g")
      .attr("transform", "translate(610,20)")
      .append(() => this.legend(
        {color: this.state.color,
          title: 'Percentage (%)',
          width: 260,
          tickFormat: d => Math.round(d)
        }));

    svg.append("g")
      .selectAll("path")
      .data(TopoFeature(this.state.map, this.state.map.objects.counties).features)
      .join("path")
      .attr("data-fips", d => this.state.data.get(d.id).fips)
      .attr("data-education", d => this.state.data.get(d.id).bachelorsOrHigher)
      .attr("fill", d => this.state.color(this.state.data.get(d.id).bachelorsOrHigher))
      .attr("d", Path())
      .on('mouseover', this.mouseoverHandler)
      .on('mouseout', this.mouseoutHandler);

    svg.append("path")
      .datum(TopoMesh(this.state.map, this.state.map.objects.states, (a, b) => a !== b))
      .attr('class', 'map__state')
      .attr("d", Path());
  }

  mouseoverHandler (e) {
    let info = this.state.data.get(+e.currentTarget.attributes['data-fips'].value),
    tooltip = Object.assign({}, this.state.tooltip);
    tooltip.text = `${info.area_name},\n${info.state}: ${info.bachelorsOrHigher}%`;
    let tooltipWidth = tooltip.pos.width + 24;
    let x = e.pageX + tooltipWidth < this.state.clientW
      ? e.pageX - tooltip.pos.left - tooltip.pos.width * 0.2
      : e.pageX - tooltip.pos.left - tooltip.pos.width * 0.8;
    x + tooltipWidth >= this.state.clientW && (x -= tooltipWidth * 0.2);
    x < 0 && (x = 0);

    let y = e.pageY - (tooltip.pos.top + tooltip.pos.height * 1.2);
    
    tooltip.style = {
      transform: `translate3d(${x}px, ${y}px, 0)`,
      opacity: 1
    };
      
    this.setState({
      tooltip: tooltip
    });
  }

  mouseoutHandler (e) {
    let tooltip = Object.assign({}, this.state.tooltip);
    tooltip.style = {
        transform: 'translate3d(0px, 0px, 0)',
        opacity: 0
      };
    this.setState({
      tooltip: tooltip
    });
  }

  render () {
    return (
      <section className='map'>
        <div className='map__layout'>
          <h1 className='map__header'>United States Educational Attainment</h1>
          <p className='map__text'>Percentage of adults age 25 and older with a bachelor's degree or higher (2010-2014)</p>
          {this.state.error 
            ? <ErrorMessage getData={this.getData}/>
            : this.state.loading 
                ? <p className='map__loading'>Loading...</p>
                : <svg className='map__svg' 
                    ref={this.svgRef}
                    preserveAspectRatio="xMidYMid meet"/>}
          <section 
            className='map__tooltip'
            ref={this.tooltipRef}
            style={this.state.tooltip.style}
            >
            {this.state.tooltip.text}
          </section>
        </div>
      </section>
    );
  }
}

function ErrorMessage (props) {
  return (
    <p className='map__error'>
      {'Information is temporarily unavailable. Please '} 
      <button 
        className='map__errorButton'
        onClick={props.getData}>try again.</button></p>
  );
}

function Footer () {
  return (
    <footer>
      <a className="footer__link" href="https://www.instagram.com/miroslavpetrov_/" target="_blank" rel="noopener noreferrer">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style={{verticalAlign: "middle", width: 16}}>
          <path d="M256 49c67 0 75 1 102 2 24 1 38 5 47 9a78 78 0 0129 18 78 78 0 0118 29c4 9 8 23 9 47 1 27 2 35 2 102l-2 102c-1 24-5 38-9 47a83 83 0 01-47 47c-9 4-23 8-47 9-27 1-35 2-102 2l-102-2c-24-1-38-5-47-9a78 78 0 01-29-18 78 78 0 01-18-29c-4-9-8-23-9-47-1-27-2-35-2-102l2-102c1-24 5-38 9-47a78 78 0 0118-29 78 78 0 0129-18c9-4 23-8 47-9 27-1 35-2 102-2m0-45c-68 0-77 0-104 2-27 1-45 5-61 11a123 123 0 00-45 29 123 123 0 00-29 45c-6 16-10 34-11 61-2 27-2 36-2 104l2 104c1 27 5 45 11 61a123 123 0 0029 45 123 123 0 0045 29c16 6 34 10 61 11a1796 1796 0 00208 0c27-1 45-5 61-11a129 129 0 0074-74c6-16 10-34 11-61 2-27 2-36 2-104l-2-104c-1-27-5-45-11-61a123 123 0 00-29-45 123 123 0 00-45-29c-16-6-34-10-61-11-27-2-36-2-104-2z"></path>
          <path d="M256 127a129 129 0 10129 129 129 129 0 00-129-129zm0 213a84 84 0 1184-84 84 84 0 01-84 84z"></path>
          <circle cx="390.5" cy="121.5" r="30.2"></circle>
        </svg> Miroslav Petrov</a>
    </footer>
  );
}

function App() {
  return (
    <div className='app'>
      <Choropleth/>
      <Footer/>
    </div>
  );
}
export default App;
