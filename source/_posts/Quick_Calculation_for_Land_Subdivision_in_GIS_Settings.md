---
title: Quick Calculation for Land Subdivision in GIS Settings
date: 2025-11-02 20:53:30
tags:
mathjax: true
---
Question: Offset one edge of a quadrilateral $l$ (since get a new edge $m$) to form a new (usually smaller) quadrilateral (parcel) of which area equals to a predefined value $A$. Find the offset distance $h$.

<img src="https://assets.meliber.work/lhm_offset_parcel.svg" style="display: block; margin-left:auto; margin-right: auto; width=30%;" />

Short answer: find the linear equation between offset distance $h$ and offset edge $m$, then solve the quadratic equation of offset $h$:
<center>$m = ah + b$</center>
<center>$A = (l + m) * h * 0.5$</center>

It's easy to pick the right root as the solution for $h$.

The linear relationship of $h$ and $m$ can be easily got from trigonometry:

<img src="https://assets.meliber.work/lhm_offset_trigonometry.svg" style="display: block; margin-left:auto; margin-right: auto; width=30%;" />

<center>$m = -(cot(α) + cot(β)) * h + l$</center>

The quadratic equation of $h$ is:
<center>$-\frac{(cot(α) + cot(β))}{2} * h^2 + l * h - A = 0$</center>
The positive root of this equation is the solution of $h$.

There is another ways to explain $m = ah + b$.

<img src="https://assets.meliber.work/uvl_offset_parcel.svg" style="display: block; margin-left:auto; margin-right: auto; width=30%;" />

Let $O$ be the origin, $\vec{u}$, $\vec{v}$ and $\vec{g}$ are vectors, then $l = || \vec{u} - \vec{v}||$, $h = ||k\vec{g} - \vec{g}||$, $m = ||k\vec{u} - k\vec{v}||$ where $k$ is the scale ratio.
Then the linear equation of $m$ and $h$ can be proved.

From the perspective of similar triangles, 
<center>$\frac{g}{l} = \frac{g+h}{m}$</center>
Simplified as:
<center>$m = \frac{l}{g}h + l$</center>

In a GIS work environment, offset a line or read length value of a line is straightforward and convenient. In order to get the equation of $m$ and $h$, a trick can be used here.

Start from the general form: $m = ah + b$

Let $h=0$, then $m_{0} = b = l$

Offset $l$ by a specific value, say 10, read $m_{10}$ from GIS software, then $m_{10} = a*10 + b$

Problem solved without angles or distance of $g$ which could be far away.

My practice is putting logic into a Excel form with 3 parameters.

Area of Need in $B66$
Length of Original Edge in $B67$
Length of Edge by offset $10$ in $B68$
Required Offset in B69: =IFERROR((-B67+SQRT(B67*B67+2*(B68-B67)/10*B66))/((B68-B67)/10),0)
