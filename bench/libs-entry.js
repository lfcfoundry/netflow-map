/* The open-source libraries the benchmarks compare against, bundled into one global named LIBS (benchmarks only). */
import * as d3force from 'd3-force'; import * as d3dsv from 'd3-dsv'; import * as d3random from 'd3-random'; import Papa from 'papaparse'; import Graph from 'graphology';
import louvain from 'graphology-communities-louvain'; import fa2 from 'graphology-layout-forceatlas2'; import * as exprEval from 'expr-eval'; import * as gifenc from 'gifenc';
import jstat from 'jstat'; import * as d3sankey from 'd3-sankey'; import dagre from '@dagrejs/dagre'; import ELK from 'elkjs/lib/elk.bundled.js'; import cytoscape from 'cytoscape'; import * as omggif from 'omggif';
export { d3sankey, d3force, d3dsv, d3random, Papa, Graph, louvain, fa2, exprEval, gifenc, jstat, dagre, ELK, cytoscape, omggif };
