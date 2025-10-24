[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/yOwut1-r)
[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=21159482&assignment_repo_type=AssignmentRepo)
# 07
Neurosynth Frontend

## Overview

Static frontend (HTML + JS + Tailwind via CDN) for exploring Neurosynth terms, related terms, and studies using boolean queries.

## Features

- Terms
	- Loads all terms on start; filters while you type in Related input
	- Click a term to fill Related and auto-run related search
- Related
	- Shows related terms sorted by jaccard (desc)
	- Live fetch while typing; click any chip to append to the Studies query
- Studies
	- Boolean toolbar: NOT, AND, OR, ", (, ), * (inserts at caret with smart spacing)
	- Query normalization before sending: (a) OR (b), NOT (x)
	- Live search (debounced) and Enter-to-search; incomplete queries are not sent
	- Results UI: title (large) + year; click to expand authors and journal
	- Filters: sort by year (asc/desc), year range (from/to)

## API Endpoints

- GET https://mil.psy.ntu.edu.tw:5000/terms
- GET https://mil.psy.ntu.edu.tw:5000/terms/<t1>  
- GET https://mil.psy.ntu.edu.tw:5000/query/<q_string>/studies  
