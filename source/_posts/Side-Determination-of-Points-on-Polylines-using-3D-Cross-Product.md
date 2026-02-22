---
title: Side Determination of Points on Polylines using 3D Cross Product
date: 2026-02-22 13:18:00
tags:
  - GIS
  - Python
  - Geometry
categories:
  - GIS Development
mathjax: true
---

**"Is this point to the left or to the right of my path?"** Or a more intuitive situation: Is the address point to the left or right of the street? This post explores how to solve this using the 3D cross product with `NumPy` and `Shapely` libraries.

---

## 1. The Core Problem: Side Determination

When moving along a directed line from point $B$ to point $C$, any point $A$ in the 2D plane must fall into one of three categories:

1.  **Left Side:** A counter-clockwise turn is needed to face the point.
2.  **Right Side:** A clockwise turn is needed to face the point.
3.  **Collinear:** The point lies exactly on the line (or its infinite extension).

To solve this mathematically, we treat the segments as vectors. Let $\mathbf{u} = \vec{BC}$ be our direction and $\mathbf{v} = \vec{BA}$ be the offset to our target point.

---

## 2. The Math: The 3D Cross Product

While the cross product is natively a 3D operation, it is the perfect tool for 2D side determination. 

### Geometric Definition
The 3D cross product ($\mathbf{u} \times \mathbf{v}$) produces a new vector that is perpendicular to both inputs. By placing our 2D vectors on the $XY$ plane (setting $z=0$), the resulting cross product vector must point directly along the $Z$-axis.



### The Right-Hand Rule
The direction of this $Z$ value follows the **Right-Hand Rule**:
* If your fingers curl from $\mathbf{u}$ to $\mathbf{v}$ and your thumb points **Up** ($+z$), the point is to the **Left**.
* If your thumb points **Down** ($-z$), the point is to the **Right**.

### Algebraic Formula
For 2D vectors extended to 3D, the calculation simplifies significantly:
$$\mathbf{u} \times \mathbf{v} = \langle 0, 0, (u_x v_y - u_y v_x) \rangle$$

---

## 3. Applied Scenario: Path Following

In a real-world application, we don't just have a single segment; we have a **Polyline ($L$)**. To determine the side relative to the "flow" of the path, we follow these steps:

1.  **Find the Nearest Point ($B$):** Locate the point on the polyline $L$ closest to our target $A$ (using Shapely's `project` method).
2.  **Establish Direction ($C$):** * **Normal Case:** Walk $5m$ forward along the polyline from $B$ to find point $C$.
    * **Endpoint Case:** If $B$ is the end of the line, walk $5m$ **backward** to find a point $C'$. To maintain a consistent forward-facing vector, we swap them: let the original $B$ be $C$ and the new $C'$ be $B$.
3.  **Construct Vectors:** Define $\mathbf{u} = C - B$ and $\mathbf{v} = A - B$.



---

## 4. Implementation: NumPy & Shapely

Using `Shapely` for linear referencing and `NumPy` for the vector math allows for concise, readable code. We use an `epsilon` threshold to account for floating-point inaccuracies.

```python
import numpy as np
from shapely.geometry import LineString, Point

def get_side_of_path(L: LineString, A_geom: Point, distance: float = 5.0, epsilon: float = 1e-9):
    # 1. Find Point B (Nearest point on L)
    dist_to_B = L.project(A_geom)
    B_geom = L.interpolate(dist_to_B)
    
    line_length = L.length
    
    # 2. Logic for Point C (Look-ahead or Endpoint Flip)
    if dist_to_B < line_length:
        # Standard: Walk forward 5m (clamped to end)
        dist_to_C = min(dist_to_B + distance, line_length)
        C_geom = L.interpolate(dist_to_C)
        B_vec = np.array([B_geom.x, B_geom.y, 0])
        C_vec = np.array([C_geom.x, C_geom.y, 0])
    else:
        # Endpoint: Walk backward 5m, then flip B and C
        dist_to_C_prime = max(line_length - distance, 0)
        C_prime_geom = L.interpolate(dist_to_C_prime)
        C_vec = np.array([B_geom.x, B_geom.y, 0]) 
        B_vec = np.array([C_prime_geom.x, C_prime_geom.y, 0])

    # 3. Vector math
    A_vec = np.array([A_geom.x, A_geom.y, 0])
    u = C_vec - B_vec
    v = A_vec - B_vec
    
    # 4. Cross Product Calculation
    z_val = np.cross(u, v)[2]
    
    # 5. Interpretation with Epsilon
    if abs(z_val) < epsilon:
        return 0, "Collinear"
    elif z_val > 0:
        return 1, "Left"
    else:
        return -1, "Right"
```
