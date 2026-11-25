# cmake/nostroma_geometry.cmake - choose the model shape the kernels are compiled for (include/nostroma/core/geometry.hpp).
#
#   -DNOSTROMA_GEOMETRY=<name>        include/nostroma/core/geometries/<name>.hpp   (default: flash_next)
#   -DNOSTROMA_GEOMETRY_FILE=<path>   any geometry header, for a shape that is not in the tree yet (day one of a new model)
#
# With neither set (or NOSTROMA_GEOMETRY=flash_next) nothing is added: no include directory, no definition, so the compile
# commands are the ones the build had before shapes were selectable.  Otherwise a one-line header
# <build>/nostroma_geometry/nostroma/core/geometry_selected.hpp names the chosen file and its directory goes first on the include
# path (geometry.hpp picks it up with __has_include).  Included by CMakeLists.txt, metal/CMakeLists.txt and sycl/CMakeLists.txt
# before any target is declared.
set(NOSTROMA_GEOMETRY "flash_next" CACHE STRING "model shape the kernels are compiled for: a header in include/nostroma/core/geometries")
set(NOSTROMA_GEOMETRY_FILE "" CACHE FILEPATH "a geometry header outside the tree (overrides NOSTROMA_GEOMETRY)")

get_filename_component(_nostroma_geo_root "${CMAKE_CURRENT_LIST_DIR}/.." ABSOLUTE)
set(_nostroma_geo_dir "${_nostroma_geo_root}/include/nostroma/core/geometries")
file(GLOB _nostroma_geo_all RELATIVE "${_nostroma_geo_dir}" "${_nostroma_geo_dir}/*.hpp")
string(REGEX REPLACE "\.hpp" "" _nostroma_geo_names "${_nostroma_geo_all}")
list(SORT _nostroma_geo_names)

set(_nostroma_geo_header "")
if(NOSTROMA_GEOMETRY_FILE)
  if(NOT EXISTS "${NOSTROMA_GEOMETRY_FILE}")
    message(FATAL_ERROR "NOSTROMA_GEOMETRY_FILE=${NOSTROMA_GEOMETRY_FILE} does not exist")
  endif()
  get_filename_component(_nostroma_geo_header "${NOSTROMA_GEOMETRY_FILE}" ABSOLUTE)
  get_filename_component(_nostroma_geo_label "${NOSTROMA_GEOMETRY_FILE}" NAME_WE)
elseif(NOT NOSTROMA_GEOMETRY STREQUAL "flash_next")
  if(NOT EXISTS "${_nostroma_geo_dir}/${NOSTROMA_GEOMETRY}.hpp")
    string(REPLACE ";" ", " _nostroma_geo_list "${_nostroma_geo_names}")
    message(FATAL_ERROR "NOSTROMA_GEOMETRY=${NOSTROMA_GEOMETRY}: no include/nostroma/core/geometries/${NOSTROMA_GEOMETRY}.hpp (have: ${_nostroma_geo_list})")
  endif()
  set(_nostroma_geo_header "${_nostroma_geo_dir}/${NOSTROMA_GEOMETRY}.hpp")
  set(_nostroma_geo_label "${NOSTROMA_GEOMETRY}")
endif()

if(_nostroma_geo_header)
  set(_nostroma_geo_out "${CMAKE_BINARY_DIR}/nostroma_geometry")
  file(MAKE_DIRECTORY "${_nostroma_geo_out}/nostroma/core")
  file(WRITE "${_nostroma_geo_out}/nostroma/core/geometry_selected.hpp.tmp"
       "// written by cmake/nostroma_geometry.cmake: the shape this build is compiled for\n#pragma once\n#include \"${_nostroma_geo_header}\"\n")
  configure_file("${_nostroma_geo_out}/nostroma/core/geometry_selected.hpp.tmp" "${_nostroma_geo_out}/nostroma/core/geometry_selected.hpp" COPYONLY)
  include_directories(BEFORE "${_nostroma_geo_out}")
  set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${_nostroma_geo_header}")
  message(STATUS "nostroma: compiled geometry ${_nostroma_geo_label} (${_nostroma_geo_header})")
else()
  message(STATUS "nostroma: compiled geometry flash_next (default)")
endif()
