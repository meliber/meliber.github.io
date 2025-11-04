---
title: A Coordinates Transformation Method for Standard Blocks
date: 2024-04-30 13:34:26
tags:
---
# 1. Introduction
In offshore petroleum exploration practice, all the coordinates of blocks designed by geologists serving a particular purpose should be provided in Degree-Minute-Second format,  in which degree uses 2 or 3 digits, minute uses 2 digits, and second uses 2 digits in one of four options 00, 15, 30, 45 ( increment with a quarter of a minute ). All coordinates should list in clockwise order starts from the name vertex (the most northeast vertex). Such a block is called a "standard block".

[Affleck Oil Field, United Kingdom](https://www.offshore-technology.com/wp-content/uploads/sites/20/2017/09/2-affleck-janice.jpg) is a example of blocks.

# 2. The Needs of Transformation

Design blocks is a daily work in resource exploration industry. Blocks serve in many purpose, including but not limited to administration (relinquish part of a block, dissolve several blocks into one block), block bid campaign, etc.

Geologists usually draft blocks on a projected geological setting basemap. Unfortunately some mapping software doesn't have snap functionality. This software can only export polygons (drafted blocks) in projected XY format. At least it can display a geodetic reference grid in 15 seconds.

A new workflow is designed to deal with the blocks:
1. Geologists design blocks with vertices of which are visually but not precisely spot on the nodes of a 15-second geodetic reference grid.
2. All blocks reside in a layer, with valid identifiers.
3. Export the design layer of blocks in projection format as text file.
4. Write a program to read the file and generate standard blocks.

# 3. Implementation
This rudimentary implementation of coordinate transform tool in Python is called "transco". The name stands for "TRANSformation of COordinates".

Transco uses [pyproj](https://github.com/pyproj4/pyproj) to do actual transformation. Pyproj is a python interface to [PROJ](http://proj.org/). [Shaplely](https://github.com/shapely/shapely) is also used in this program. Shapely is a python wrapper of [GEOS](https://github.com/libgeos/geos).

## 3.1 class
Transco use 3 classes to represent the data: Layer, Block and Point. points are property of Block instance, and blocks are property of Layer instance.

The definition of Layer like this:
```python
class Layer:
    """
    represents a DoubleFox layer contains designed blocks.
    """

    def __init__(
        self,
        layer_file,
        coor_type="proj",
        crs="wgs84utm",
        location="location",
        compute_name=False,
    ):
        self.raw_lines = []
        self.bad_lines = []
        self._blocks = []
        self.cblocks = []
        self.coor_type = coor_type
        self.compute_name = compute_name
        self.name = layer_file.stem.replace("/", "_").replace("\\", "_")
        self.crs = get_crs(coor_type, crs, location)
        self.transformer = None
        self.transform_direction = "proj2geo"
        self.location = location
        self.transformer = get_transformer(self.crs, direction="proj2geo")
        with open(layer_file) as f:
            self.raw_lines = f.readlines()
        lines = copy.deepcopy(self.raw_lines)
        index_for_del = []
        for index, l in enumerate(lines):
            try:
                n, x, y = l.split(",")[:3]
                float(x)
                float(y)
            except:
                index_for_del.append(index)
                self.bad_lines.append(str(index + 1) + "," + l)
                continue
            finally:
                if not n:
                    raise Exception("Found point has no name")
        for i in sorted(index_for_del, reverse=True):
            del lines[i]
        groups = groupby(lines, key=lambda x: x.split(",")[0])
        self.raw_blocks = [
            [p.strip().split(",")[:3] for p in lines] for name, lines in groups
        ]
        for b in self.raw_blocks:
            block = Block(self, b)
            self._blocks.append(block)
        sorted_blocks = sorted(self.blocks, key=lambda x: x.name)
        block_groups = groupby(sorted_blocks, key=lambda x: x.name)
        raw_cblocks = [[b for b in cblock] for name, cblock in block_groups]
        for cb in raw_cblocks:
            _cb = CBlock(self, cb)
            self.cblocks.append(_cb)

    @property
    def blocks(self):
        if len(self._blocks) == len(self.raw_blocks):
            return self._blocks
        raise

    def __str__(self):
        return self.name + ":{} blocks".format(len(self.blocks))

    def __repr__(self):
        return self.__str__()
```
The `coor_type`, `crs`, `location` properties are used to get the correspond CRS object from pyproj.

The Block class:
```python
class Block:
    """A raw block resides in a Layer object."""

    def __init__(self, layer, block):
        self.layer = layer
        self.location = self.layer.location
        self.order = 0
        self.crs = self.layer.crs
        self.transformer = self.layer.transformer
        name_str = block[0][0]
        try:
            name, order = name_str.split("--")
            order = int(order)
            if name.strip():
                self.name = name.strip().replace("/", "").replace("\\", "")
            if order >= 1:
                self.order = order
        except:
            self.name = name_str.rstrip("--").strip().replace("/", "").replace("\\", "")
        if not self.name:
            raise Exception("Failed to create a name for this Block")
        self._points = []
        for p in block:
            point = Point(self, p)
            self._points.append(point)
        self.__regular_points()
        self.__unparallel_points()
        self.get_code_name()

    @property
    def points(self):
        return self._points
```

The block object gets CRS information from its Layer object.

And the Point class looks like:
```python
class Point:
    """represents a point resides in a Block object."""

    def __init__(self, block, point):
        self.block = block
        self.name = point[0].replace("/", "").replace("\\", "")
        self.x = float(point[1])
        self.y = float(point[2])
        self.lo_deg = None
        self.la_deg = None
        self.lo_dms = None
        self.la_dms = None
        self.offset_lo_dms = None
        self.offset_la_dms = None
        self.crs = self.block.crs
        self.transformer = self.block.transformer
        self._deg()
        self._dms()
        self._offset()
        self._offset_2_dms()
```
Like before, the point instance gets CRS from its Block object.

## 3.2 Function

So the basic idea is, original XY coordinates are transformed into Degrees, then snap to the nearest geodetic reference grid node by _offset method.

There are some functions to modidy the blocks, like rotate points if it's not clockwise, remove reduandant points, check errors, compute block name by spatial relationship, etc.

Here is the function for getting CRS.
```python
def get_crs(coor_type, crs, location):
    try:
        epsg_code = defined_crs[coor_type][crs][location]
        return CRS.from_epsg(epsg_code)
    except:
        return None
```

Transform Degree to DMS:
```python
def d2dms(x):
    """
    Transform a single float degree value to DMS format.
    return a tuple of degree, minute, second in float.
    >>> d2dms(113.5)
    (113.0, 30.0, 0.0)
    >>> d2dms(20.254166667)
    (20.0, 15.0, 15.000001199999247)
    """
    d_decimal, d = math.modf(x)
    m_decimal, m = math.modf(d_decimal * 60)
    s = m_decimal * 60
    return d, m, s
```

The last setup is defining functions to call methods of objects.
```python
def load_file(
    file="df_design.txt", coor_type="proj", crs="wgs84utm", location="location"
):
    f = Path(file)
    return Layer(f, coor_type, crs, location)

def save_default(layer):
    layer.save_standardized_blocks()
    layer.save_blocks_area_info_wgs84utm()

def available_crs(defined_crs):
    all_crs = {}
    for key, value in defined_crs.items():
        if value:
            all_crs[key] = value
    return all_crs

def show_help(**kw):
    print(__desc__)
    print("Version {}".format(__version__))
    print("Author: ", __author__)
    print(__transco_help__)
    location = kw.get("location", None)
    if location:
        try:
            crs = get_crs("proj", "wgs84utm", location)
        except:
            print("Failed to get CRS.")
            raise
        if crs:
            print("Current CRS:")
            print(crs.name)
            print("Area of Use:")
            print(crs.area_of_use)

def main():
    parser = argparse.ArgumentParser(description=__desc__)
    parser.add_argument(
        "file", help="the input file, default is 'df_design.txt'.", nargs="?"
    )
    parser.add_argument(
        "location",
        help="the location for projection selection, default is 'location'.",
        nargs="?",
    )
    parser.add_argument(
        "-a", "--all", action="store_true", help="save all output files"
    )
    parser.add_argument("--version", action="store_true", help="show version")
    parser.add_argument("--allcrs", action="store_true", help="show all available CRS")
    args = parser.parse_args()
    try:
...
```

After that, I can call the `main` function in CLI, or call functions and calss directly in a interactive python environment, or use it in a Jupyter notebook.
