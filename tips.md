# Some tips for my site 

## CSS: 
- "[reset css](https://gist.github.com/DavidWells/18e73022e723037a50d6)" for clear all css options 


## general settings 
- check actual updates 
    ``` command line
    ncu -u --packageFile package.json
    ```

## @media

@media screen and (max-width: 1300px) {}
@media screen and (max-width: 1000px) {}
@media screen and (max-width: 750px) {}
@media screen and (max-width: 450px) {}


## css hack safari

- "[list of hacks](https://browserstrangeness.bitbucket.io/css_hacks.html#safari)" 

``` css
@media not all and (min-resolution:.001dpcm) { 
    @supports (-webkit-appearance:none) and (display:flow-root)  {

        .class {

        }

        @media screen and (max-width: 1000px) {
            .class {
                
            }
        }
    }
}
```